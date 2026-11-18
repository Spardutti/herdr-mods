import assert from "node:assert/strict";

/** The three Jest matchers the tests ported from claude-mods use. */
export const expect = (actual) => ({
  toEqual: (expected) => assert.deepEqual(actual, expected),
  toBe: (expected) => assert.equal(actual, expected),
  toBeUndefined: () => assert.equal(actual, undefined),
});
