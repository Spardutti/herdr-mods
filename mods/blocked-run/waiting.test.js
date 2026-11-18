import { test } from "node:test";
import assert from "node:assert/strict";
import { bangLine, forSpace, parseWaiting, queueOf, withoutItem } from "./waiting.js";

const record = (terminal, ...queue) => JSON.stringify({ terminal, queue }) + "\n";
const item = (terminal, command, index, asked = true) => ({ terminal, command, asked, index });

test("parseWaiting reads each terminal's queue in order", () => {
  const text = record("t2p", { command: "git push", asked: true }, { command: "gh pr merge 50", asked: false }) + record("t1y", { command: "ls", asked: true });

  assert.deepEqual(parseWaiting(text), [item("t2p", "git push", 0), item("t2p", "gh pr merge 50", 1, false), item("t1y", "ls", 0)]);
});

test("parseWaiting skips a broken line and a terminal id with a slash", () => {
  const text = `not json\n${record("../t2p", { command: "ls", asked: true })}`;

  assert.deepEqual(parseWaiting(text), []);
});

test("parseWaiting drops a command with a control character and renumbers the rest", () => {
  const text = record("t2p", { command: "echo \u001b[2J", asked: true }, { command: "git push", asked: true });

  assert.deepEqual(parseWaiting(text), [item("t2p", "git push", 0)]);
});

test("parseWaiting keeps a command split over lines", () => {
  const text = record("t2p", { command: "docker compose up \\\n  --build web", asked: true });

  assert.equal(parseWaiting(text)[0].command, "docker compose up \\\n  --build web");
});

test("forSpace keeps only the commands from the space's terminals", () => {
  const waiting = [item("t2p", "git push", 0), item("t1y", "ls", 0)];

  assert.deepEqual(forSpace(waiting, ["wsl/t2p", "wsl/t2r"], "wsl"), [item("t2p", "git push", 0)]);
});

test("forSpace on this computer matches bare terminal addresses", () => {
  assert.deepEqual(forSpace([item("t5", "ls", 0)], ["t5"], null), [item("t5", "ls", 0)]);
});

test("queueOf gives a terminal's queue back in the file's shape", () => {
  const waiting = [item("t2p", "a", 0), item("t1y", "b", 0), item("t2p", "c", 1, false)];

  assert.deepEqual(queueOf(waiting, "t2p"), [{ command: "a", asked: true }, { command: "c", asked: false }]);
});

test("withoutItem drops the item at the index", () => {
  assert.deepEqual(withoutItem(["a", "b", "c"], 1), ["a", "c"]);
});

test("bangLine puts Claude's shell-mode prefix before the command", () => {
  assert.equal(bangLine("gh pr merge 50"), "! gh pr merge 50");
});
