import { test } from "node:test";
import { expect } from "../../test-support/expect.js";

import { newReads } from "./reads.js";

test("a second read can't start while one is running", () => {
  const reads = newReads();
  reads.start();

  expect(reads.start()).toBe(null);
});

test("a read that finishes with no change in between is fresh", () => {
  const reads = newReads();
  const seen = reads.start();

  expect(reads.finish(seen)).toBe(true);
});

test("the next read can start once the running one finishes", () => {
  const reads = newReads();
  reads.finish(reads.start());

  expect(reads.start()).toBe(0);
});

test("a read that started before a change finishes stale", () => {
  const reads = newReads();
  const seen = reads.start();

  reads.invalidate();

  expect(reads.finish(seen)).toBe(false);
});

test("a change lets a new read start while the old one still runs", () => {
  const reads = newReads();
  reads.start();

  reads.invalidate();

  expect(reads.start()).toBe(1);
});

test("a stale read finishing late doesn't free the newer one", () => {
  const reads = newReads();
  const old = reads.start();
  reads.invalidate();
  reads.start();

  reads.finish(old);

  expect(reads.start()).toBe(null);
});
