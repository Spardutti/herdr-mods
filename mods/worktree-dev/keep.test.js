import { test } from "node:test";
import assert from "node:assert/strict";
import { keepCommand, otherAgents } from "./keep.js";

const space = { id: "s1", tabs: [{ id: "t1" }, { id: "t2" }] };

test("keepCommand for the only pane of space s1 closes the space confirmed", () => {
  assert.deepEqual(keepCommand("p1", space, [{ pane: "p1", tab: "t1" }, { pane: "p9", tab: "t9" }]),
    { name: "space.close", args: { id: "s1", confirmed: true } });
});

test("keepCommand with a second pane in s1's other tab closes only pane p1", () => {
  assert.deepEqual(keepCommand("p1", space, [{ pane: "p1", tab: "t1" }, { pane: "p2", tab: "t2" }]),
    { name: "pane.close", args: { pane: "p1" } });
});

test("otherAgents counts the 2 other agents in s1 and skips p1 itself and space s2", () => {
  const agents = [{ pane: "p1", space: "s1" }, { pane: "p2", space: "s1" }, { pane: "p3", space: "s1" }, { pane: "p4", space: "s2" }];
  assert.equal(otherAgents("p1", "s1", agents), 2);
});
