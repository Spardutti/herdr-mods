import { test } from "node:test";
import assert from "node:assert/strict";
import { cpuPercent, cpuTimes, gib, memory } from "./usage.js";

test("cpuTimes sums busy and total from the cpu line", () => {
  const stat = "cpu  10 2 5 80 3 1 1 0 0 0\ncpu0 1 1 1 1 1 1 1 1 0 0\n";
  assert.deepEqual(cpuTimes(stat), { busy: 19, total: 102 });
});

test("cpuTimes returns null without a cpu line", () => {
  assert.equal(cpuTimes("intr 1 2 3\n"), null);
});

test("cpuPercent is the busy share between two reads", () => {
  assert.equal(cpuPercent({ busy: 100, total: 1000 }, { busy: 125, total: 1100 }), 25);
});

test("cpuPercent is 0 when no time passed", () => {
  assert.equal(cpuPercent({ busy: 5, total: 10 }, { busy: 5, total: 10 }), 0);
});

test("memory counts used as total minus available", () => {
  const meminfo = "MemTotal:       16000000 kB\nMemFree:  1000 kB\nMemAvailable:   12000000 kB\nSwapTotal: 4000000 kB\nSwapFree: 3000000 kB\n";
  assert.deepEqual(memory(meminfo), { used: 4000000, total: 16000000, swapUsed: 1000000, swapTotal: 4000000 });
});

test("gib turns kB into GiB with one decimal", () => {
  assert.equal(gib(1572864), "1.5");
});

test("cpuPercent counts one tick of time", () => {
  assert.equal(cpuPercent({ busy: 0, total: 0 }, { busy: 1, total: 1 }), 100);
});

test("memory reads a missing key as 0", () => {
  assert.deepEqual(memory("MemTotal: 8 kB\nMemAvailable: 2 kB\n"), { used: 6, total: 8, swapUsed: 0, swapTotal: 0 });
});
