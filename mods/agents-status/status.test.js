import { test } from "node:test";
import assert from "node:assert/strict";
import { age, byProject, displayName, firstNeedingYou, grouped, track } from "./status.js";

const agent = (address, status, extra = {}) => ({ address, status, title: "", tab_name: "1", ...extra });

test("grouped puts agents that need you first, then working, then idle", () => {
  const list = [agent("a", "idle"), agent("b", "working"), agent("c", "done"), agent("d", "blocked")];

  const groups = grouped(list).map((g) => [g.id, g.members.map((a) => a.address)]);

  assert.deepEqual(groups, [["needs", ["d", "c"]], ["working", ["b"]], ["idle", ["a"]]]);
});

test("grouped leaves out empty groups", () => {
  assert.deepEqual(grouped([agent("a", "idle")]).map((g) => g.id), ["idle"]);
});

test("grouped keeps Herdr's order inside a group", () => {
  const list = [agent("x", "working"), agent("y", "working")];

  assert.deepEqual(grouped(list)[0].members.map((a) => a.address), ["x", "y"]);
});

const at = (pairs) => Object.fromEntries(pairs.map(([address, time]) => [address, { at: time }]));
const projects = (list, changed = {}) => byProject(list, changed).map((p) => [p.name, p.members.map((a) => a.address)]);

test("byProject puts a project that needs you first, then one with work running, then idle ones", () => {
  const list = [agent("a", "idle", { space: "s1", space_name: "quiet" }), agent("b", "working", { space: "s2", space_name: "busy" }), agent("c", "blocked", { space: "s3", space_name: "stuck" })];

  assert.deepEqual(projects(list), [["stuck", ["c"]], ["busy", ["b"]], ["quiet", ["a"]]]);
});

test("byProject puts the idle project used most recently first", () => {
  const list = [agent("a", "idle", { space: "s1", space_name: "old" }), agent("b", "idle", { space: "s2", space_name: "new" })];

  assert.deepEqual(projects(list, at([["a", 100], ["b", 200]])), [["new", ["b"]], ["old", ["a"]]]);
});

test("byProject orders chats inside a project by urgency", () => {
  const list = [agent("a", "idle", { space: "s1", space_name: "app" }), agent("b", "done", { space: "s1", space_name: "app" }), agent("c", "working", { space: "s1", space_name: "app" })];

  assert.deepEqual(projects(list), [["app", ["b", "c", "a"]]]);
});

test("byProject keeps two spaces with the same name apart", () => {
  const list = [agent("a", "idle", { space: "s1", space_name: "herdr-mods" }), agent("b", "idle", { space: "wsl/s2", space_name: "herdr-mods" })];

  assert.deepEqual(byProject(list, {}).map((p) => p.id), ["s1", "wsl/s2"]);
});

test("byProject of no agents is empty", () => {
  assert.deepEqual(byProject([], {}), []);
});
for (const [ms, text] of [[59_999, "<1m"], [60_000, "1m"], [3_599_999, "59m"], [3_600_000, "1h"], [86_399_999, "23h"], [86_400_000, "1d"]]) {
  test(`age of ${ms} ms reads ${text}`, () => {
    assert.equal(age(ms), text);
  });
}

test("displayName drops the spinner glyph Claude puts before its title", () => {
  assert.equal(displayName(agent("a", "idle", { title: "✳ SBRD-315 Jira ticket" })), "SBRD-315 Jira ticket");
});

test("displayName falls back to the tab name without a title", () => {
  assert.equal(displayName(agent("a", "idle", { tab_name: "Main" })), "Main");
});

test("firstNeedingYou picks the top of the needs-you group", () => {
  const list = [agent("a", "working"), agent("b", "done"), agent("c", "blocked")];

  assert.equal(firstNeedingYou(list).address, "c");
});

test("firstNeedingYou is null when nothing needs you", () => {
  assert.equal(firstNeedingYou([agent("a", "working"), agent("b", "idle")]), null);
});

test("track stamps an agent whose status changed", () => {
  const changed = track({ a: { s: "idle", at: 1 } }, [agent("a", "working")], 500);

  assert.deepEqual(changed, { a: { s: "working", at: 500 } });
});

test("track treats done and idle as the same state", () => {
  const before = { a: { s: "idle", at: 1 } };

  assert.equal(track(before, [agent("a", "done")], 500), before);
});
