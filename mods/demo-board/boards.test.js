import { test } from "node:test";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect } from "../../test-support/expect.js";

import { boardAfterRead, boardUrl, turnOffCommand } from "./boards.js";

test("a failed read keeps the board the box already shows", () => {
  const shown = { name: "acomer", url: "https://claude.ai/artifact/a1" };
  expect(boardAfterRead(shown, "acomer", undefined)).toBe(shown);
});

test("a failed read in a new project shows the board as off", () => {
  expect(boardAfterRead({ name: "other", url: "https://claude.ai/artifact/z9" }, "acomer", undefined)).toEqual({ name: "acomer", url: null });
});

test("a read of an emptied list turns the shown board off", () => {
  expect(boardAfterRead({ name: "acomer", url: "https://claude.ai/artifact/a1" }, "acomer", "")).toEqual({ name: "acomer", url: null });
});

test("a project with a line gets its board link", () => {
  expect(boardUrl("other\thttps://claude.ai/artifact/z9\nacomer\thttps://claude.ai/artifact/a1\n", "acomer")).toBe("https://claude.ai/artifact/a1");
});

test("a project whose name only starts the same has no board", () => {
  expect(boardUrl("acomer-api\thttps://claude.ai/artifact/b2\n", "acomer")).toBe(null);
});

test("a link that is not on claude.ai is ignored", () => {
  expect(boardUrl("acomer\thttps://evil.example/x\n", "acomer")).toBe(null);
});

test("a comment line is not a project", () => {
  expect(boardUrl("# project\thttps://claude.ai/artifact/c3\n", "# project")).toBe(null);
});

test("an empty or missing file means every board is off", () => {
  expect(boardUrl("", "acomer")).toBe(null);
  expect(boardUrl(undefined, "acomer")).toBe(null);
});

function turnOffIn(tsv, project) {
  const home = mkdtempSync(join(tmpdir(), "demo-board-"));
  const file = join(home, ".config", "demo-board", "boards.tsv");
  mkdirSync(join(home, ".config", "demo-board"), { recursive: true });
  writeFileSync(file, tsv);
  const [cmd, ...args] = turnOffCommand(project);
  execFileSync(cmd, args, { env: { ...process.env, HOME: home } });
  const left = readFileSync(file, "utf8");
  rmSync(home, { recursive: true });
  return left;
}

test("turning off removes a line boardUrl finds despite a space after the name", () => {
  expect(turnOffIn("acomer \thttps://claude.ai/artifact/a1\nkeep\thttps://claude.ai/artifact/b2\n", "acomer")).toBe("keep\thttps://claude.ai/artifact/b2\n");
});

test("turning off matches a project name with a backslash exactly", () => {
  expect(turnOffIn("a\\nb\thttps://claude.ai/artifact/a1\n", "a\\nb")).toBe("");
});

test("turning off passes the project name as its own argument", () => {
  const argv = turnOffCommand("a b'c");
  expect(argv.slice(0, 2)).toEqual(["sh", "-c"]);
  expect(argv.slice(3)).toEqual(["sh", "a b'c"]);
  expect(argv[2].includes("a b'c")).toBe(false);
});
