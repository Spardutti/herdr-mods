#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { boardUrl, READ_BOARDS } from "../boards.js";
import { projectName } from "../project.js";
import { reminderFor } from "../reminder.js";

const run = (argv, cwd) => {
  try {
    return execFileSync(argv[0], argv.slice(1), { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  } catch {
    return undefined;
  }
};

/** Reads the hook JSON from stdin and prints additionalContext when the project's board is on. */
async function main() {
  let text = "";
  for await (const chunk of process.stdin) text += chunk;
  const input = JSON.parse(text);
  const command = input.tool_input?.command ?? "";
  if (!reminderFor(command, "https://claude.ai/")) return;
  const cwd = input.cwd ?? process.cwd();
  const name = projectName(run(["git", "rev-parse", "--path-format=absolute", "--git-common-dir"], cwd), cwd);
  const note = reminderFor(command, boardUrl(run(READ_BOARDS, cwd), name));
  if (!note) return;
  console.log(JSON.stringify({ hookSpecificOutput: { hookEventName: "PostToolUse", additionalContext: note } }));
}

main().catch(() => {});
