import { knownAgents, openOverlay, run, setShared } from "herdr";

export const VIEW = "agent-board.view";

/** Claude Code's start command on that machine, or plain `claude` when the check fails. */
export async function claudeArgv(machine) {
  const list = await knownAgents({ on: machine }).catch(() => []);
  return list.find((a) => a.key === "claude" && a.installed)?.run ?? ["claude"];
}

function select(child) {
  run("layout.select", { stack: "view", child });
  setShared(VIEW, child);
}

export function openChat(card) {
  run("pane.focus", { pane: card.pane });
  select("work");
}

export function showBoard() {
  select("board");
  run("agent-board.grab");
}

export async function newAgent(spaceId, machine) {
  run("tab.new", { name: "Claude Code", space: spaceId, argv: await claudeArgv(machine), focus: false });
}

export async function newWorktreeAgent(spaceId, folder, machine) {
  const argv = await claudeArgv(machine);
  openOverlay({ mod: "worktree", kind: "dialog", width: 460, height: 280, props: { space: spaceId, folder, action: "new", argv } });
}
