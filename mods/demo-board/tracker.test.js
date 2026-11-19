import { test } from "node:test";
import { expect } from "../../test-support/expect.js";

import { newTracker } from "./tracker.js";

test("a read that started before a change is not fresh", () => {
  const tracker = newTracker();
  const seen = tracker.begin();

  tracker.change();

  expect(tracker.isFresh(seen)).toBe(false);
});

test("a read that started after a change is fresh", () => {
  const tracker = newTracker();
  tracker.change();

  expect(tracker.isFresh(tracker.begin())).toBe(true);
});
