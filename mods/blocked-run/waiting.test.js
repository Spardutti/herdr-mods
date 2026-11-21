import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DROP_SCRIPT, bangLine, forSpace, newCards, newTracker, parseWaiting, runThenDrop, withoutPending } from "./waiting.js";

function machineWith(...queue) {
  const home = mkdtempSync(join(tmpdir(), "blocked-"));
  const folder = join(home, ".config", "herdr-blocked");
  mkdirSync(folder, { recursive: true });
  const file = join(folder, "t2p.json");
  writeFileSync(file, JSON.stringify({ terminal: "t2p", queue }) + "\n");
  const drop = (command) => execFileSync("python3", ["-I", "-c", DROP_SCRIPT, "t2p", command], { env: { HOME: home, PATH: process.env.PATH } });
  const left = () => (existsSync(file) ? JSON.parse(readFileSync(file, "utf8")).queue.map((i) => i.command) : null);
  return { drop, left };
}

const record = (terminal, ...queue) => JSON.stringify({ terminal, queue }) + "\n";
const item = (terminal, command, index, asked = true) => ({ terminal, command, asked, index });

test("parseWaiting reads each terminal's queue in order", () => {
  const text = record("t2p", { command: "git push", asked: true }, { command: "gh pr merge 50", asked: false }) + record("t1y", { command: "ls", asked: true });

  assert.deepEqual(parseWaiting(text), [item("t2p", "git push", 0), item("t2p", "gh pr merge 50", 1, false), item("t1y", "ls", 0)]);
});

test("parseWaiting skips a broken line and still reads the record after it", () => {
  const text = `not json\n${record("t2p", { command: "ls", asked: true })}`;

  assert.deepEqual(parseWaiting(text), [item("t2p", "ls", 0)]);
});

test("parseWaiting skips a record whose terminal id has a slash", () => {
  assert.deepEqual(parseWaiting(record("../t2p", { command: "ls", asked: true })), []);
});

test("parseWaiting drops a command with a control character", () => {
  const text = record("t2p", { command: "echo \u001b[2J", asked: true });

  assert.deepEqual(parseWaiting(text), []);
});

test("parseWaiting numbers the commands left after a dropped one from 0", () => {
  const text = record("t2p", { command: "echo \u001b[2J", asked: true }, { command: "git push", asked: true });

  assert.equal(parseWaiting(text)[0].index, 0);
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

test("dropping two commands in a row removes exactly those two", () => {
  const machine = machineWith({ command: "a", asked: true }, { command: "b", asked: true }, { command: "c", asked: true });

  machine.drop("a");
  machine.drop("c");

  assert.deepEqual(machine.left(), ["b"]);
});

test("dropping a command keeps one the hook added after the box last looked", () => {
  const machine = machineWith({ command: "git push", asked: true }, { command: "gh pr merge 50", asked: false });

  machine.drop("git push");

  assert.deepEqual(machine.left(), ["gh pr merge 50"]);
});

test("dropping the last command removes the file", () => {
  const machine = machineWith({ command: "git push", asked: true });

  machine.drop("git push");

  assert.equal(machine.left(), null);
});

test("runThenDrop drops the command once it was typed in", async () => {
  const dropped = [];

  await runThenDrop(async () => ({ code: 0 }), async (i) => dropped.push(i), "git push");

  assert.deepEqual(dropped, ["git push"]);
});

test("runThenDrop keeps the command when typing it in failed", async () => {
  const dropped = [];

  const ran = await runThenDrop(async () => { throw new Error("terminal gone"); }, async (i) => dropped.push(i), "git push");

  assert.deepEqual([ran, dropped], [false, []]);
});

test("a check that started before a Run is not fresh", () => {
  const tracker = newTracker();
  const seen = tracker.begin();

  tracker.change();

  assert.equal(tracker.isFresh(seen), false);
});

test("a check that started after a Run is fresh", () => {
  const tracker = newTracker();
  tracker.change();

  assert.equal(tracker.isFresh(tracker.begin()), true);
});

test("bangLine puts Claude's shell-mode prefix before the command", () => {
  assert.equal(bangLine("gh pr merge 50"), "! gh pr merge 50");
});

test("withoutPending hides a command still being run when a check reads it back", () => {
  const waiting = [item("t2p", "git push", 0), item("t2p", "ls", 1)];

  assert.deepEqual(withoutPending(waiting, [item("t2p", "git push", 0)]), [item("t2p", "ls", 1)]);
});

test("withoutPending keeps the same command from another terminal", () => {
  assert.deepEqual(withoutPending([item("t1y", "git push", 0)], [item("t2p", "git push", 0)]), [item("t1y", "git push", 0)]);
});

test("a card stays hidden after its run ends", () => {
  const cards = newCards();
  cards.loaded([item("t2p", "git push", 0), item("t2p", "ls", 1)]);

  const clicked = cards.shown()[0];
  cards.hide(clicked);
  cards.release(clicked);

  assert.deepEqual(cards.shown(), [item("t2p", "ls", 1)]);
});

test("a check during the run does not bring the card back", () => {
  const cards = newCards();
  cards.loaded([item("t2p", "git push", 0)]);
  cards.hide(cards.shown()[0]);

  cards.loaded([item("t2p", "git push", 0), item("t2p", "ls", 1)]);

  assert.deepEqual(cards.shown(), [item("t2p", "ls", 1)]);
});

test("a check after a failed run brings the card back", () => {
  const cards = newCards();
  cards.loaded([item("t2p", "git push", 0)]);
  const clicked = cards.shown()[0];
  cards.hide(clicked);
  cards.release(clicked);

  cards.loaded([item("t2p", "git push", 0)]);

  assert.deepEqual(cards.shown(), [item("t2p", "git push", 0)]);
});
