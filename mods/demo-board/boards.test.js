import { test } from "node:test";
import { expect } from "../../test-support/expect.js";

import { boardUrl, turnOffCommand } from "./boards.js";

test("a project with a line gets its board link", () => {
  expect(boardUrl("other\thttps://claude.ai/artifact/z9\nacomer\thttps://claude.ai/artifact/a1\n", "acomer")).toBe("https://claude.ai/artifact/a1");
});

test("a project whose name only starts the same has no board", () => {
  expect(boardUrl("acomer-api\thttps://claude.ai/artifact/b2\n", "acomer")).toBe(null);
});

test("a link that is not on claude.ai is ignored", () => {
  expect(boardUrl("acomer\thttps://evil.example/x\n", "acomer")).toBe(null);
});

test("a comment line is not a project", () => {
  expect(boardUrl("# project\thttps://claude.ai/artifact/c3\n", "# project")).toBe(null);
});

test("an empty or missing file means every board is off", () => {
  expect(boardUrl("", "acomer")).toBe(null);
  expect(boardUrl(undefined, "acomer")).toBe(null);
});

test("turning off passes the project name as its own argument", () => {
  const argv = turnOffCommand("a b'c");
  expect(argv.slice(0, 2)).toEqual(["sh", "-c"]);
  expect(argv.slice(3)).toEqual(["sh", "a b'c"]);
  expect(argv[2].includes("a b'c")).toBe(false);
});
