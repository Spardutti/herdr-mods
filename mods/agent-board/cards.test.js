import { test } from "node:test";
import assert from "node:assert/strict";
import { boardCards, filterCounts, isWorktree, matchCards, needsYou, nextCard, prevCard } from "./cards.js";

const agent = (address, status, extra = {}) => ({
  address, status, pane: `p-${address}`, space: "wsl/s1", space_name: "app", title: "", tab_name: "2", seq: 0, ...extra,
});
test("boardCards keeps Herdr's order whatever the status: [w, b] stays [w, b]", () => {
  const list = [agent("w", "working"), agent("b", "blocked")];

  assert.deepEqual(boardCards(list, [], "all").map((c) => c.address), ["w", "b"]);
});

test("boardCards with filter \"working\" drops the blocked card", () => {
  const list = [agent("w", "working"), agent("b", "blocked")];

  assert.deepEqual(boardCards(list, [], "working").map((c) => c.address), ["w"]);
});

test("boardCards takes branch \"fix/x\" and cwd from the agent's pane p3", () => {
  const list = [agent("a", "idle", { pane: "p3" })];
  const panes = [{ pane: "p3", cwd: "/h/.herdr/worktrees/app/fix-x", branch: "fix/x" }];

  const [card] = boardCards(list, panes, "all");

  assert.deepEqual([card.cwd, card.branch, card.worktree], ["/h/.herdr/worktrees/app/fix-x", "fix/x", true]);
});

test("boardCards names a card by its space and its machine by the space id", () => {
  const [card] = boardCards([agent("a", "idle", { space: "wsl/s9", space_name: "herdr-mods" })], [], "all");

  assert.deepEqual([card.project, card.machine], ["herdr-mods", "wsl"]);
});

test("boardCards strips the status glyph from the title, and falls back to the tab name", () => {
  const list = [agent("a", "idle", { title: "✳ Fix the login", seq: 2 }), agent("b", "idle", { title: "⠋ ", seq: 1 })];

  const titles = boardCards(list, [], "all").map((c) => c.title);

  assert.deepEqual(titles, ["Fix the login", "2"]);
});

test("boardCards names the agent by its program, else its app, else \"agent\"; no pane leaves cwd and branch null", () => {
  const list = [agent("a", "idle", { seq: 3, program: { name: "Claude Code" } }), agent("b", "idle", { seq: 2, app: "codex" }), agent("c", "idle", { seq: 1 })];

  const cards = boardCards(list, [], "all");

  assert.deepEqual(cards.map((c) => [c.agent, c.cwd, c.branch, c.worktree]), [["Claude Code", null, null, false], ["codex", null, null, false], ["agent", null, null, false]]);
});

const cards = (...statuses) => statuses.map((status, i) => ({ address: `a${i}`, pane: `p${i}`, status }));

test("nextCard after p1 of three is p2, after p2 wraps to p0, with none focused is p0", () => {
  const list = cards("idle", "idle", "idle");

  assert.deepEqual([nextCard(list, "p1").pane, nextCard(list, "p2").pane, nextCard(list, null).pane], ["p2", "p0", "p0"]);
});

test("prevCard before p1 of three is p0, before p0 wraps to p2, with none focused is p2", () => {
  const list = cards("idle", "idle", "idle");

  assert.deepEqual([prevCard(list, "p1").pane, prevCard(list, "p0").pane, prevCard(list, null).pane], ["p0", "p2", "p2"]);
});

test("nextCard and prevCard of no cards are null", () => {
  assert.deepEqual([nextCard([], null), prevCard([], null)], [null, null]);
});

test("needsYou picks the first blocked card over an earlier done one, else the first done, else null", () => {
  assert.deepEqual([
    needsYou(cards("done", "blocked", "blocked"))?.pane,
    needsYou(cards("idle", "done", "done"))?.pane,
    needsYou(cards("idle", "working")),
  ], ["p1", "p1", null]);
});

test("filterCounts of 2 blocked and 1 idle gives { all: 3, blocked: 2, done: 0, working: 0, idle: 1 }", () => {
  const list = [agent("a", "blocked"), agent("b", "blocked"), agent("c", "idle")];

  assert.deepEqual(filterCounts(list), { all: 3, blocked: 2, done: 0, working: 0, idle: 1 });
});

test("isWorktree(\"/home/u/.herdr/worktrees/app/fix-x\") is true, \"/home/u/projects/app\" is false", () => {
  assert.deepEqual([isWorktree("/home/u/.herdr/worktrees/app/fix-x"), isWorktree("/home/u/projects/app"), isWorktree(null)], [true, false, false]);
});

test("matchCards(\"otacon remind\") keeps the otacon card about reminders and drops the others", () => {
  const list = [
    { address: "a", project: "otacon", title: "Month reminders", branch: "feat/reminders", agent: "Claude Code" },
    { address: "b", project: "otacon", title: "Fix login", branch: null, agent: "Claude Code" },
    { address: "c", project: "stash", title: "Remind me later", branch: "main", agent: "Claude Code" },
  ];

  assert.deepEqual(matchCards(list, "Otacon  remind").map((c) => c.address), ["a"]);
});

test("matchCards finds a card by its branch, and an empty query keeps every card", () => {
  const list = [{ address: "a", project: "app", title: "x", branch: "fix/login", agent: "codex" }, { address: "b", project: "app", title: "y", branch: null, agent: "codex" }];

  assert.deepEqual([matchCards(list, "login").map((c) => c.address), matchCards(list, " ").length], [["a"], 2]);
});
