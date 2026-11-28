import { test } from "node:test";
import assert from "node:assert/strict";
import { branchName } from "./branch-name.js";

test("branchName turns \"  boss  passive \" into \"boss-passive\" and keeps \"feat/x\"", () => {
  assert.deepEqual([branchName("  boss  passive "), branchName("feat/x")], ["boss-passive", "feat/x"]);
});
