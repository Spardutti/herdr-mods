import { test, beforeEach } from "node:test";
import { mkdtempSync, readdirSync, readFileSync, existsSync, writeFileSync, renameSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect } from "../../../test-support/expect.js";
import { run } from "./todos.mjs";

let dir;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "todos-cli-"));
  process.env.TODOS_DIR = dir;
});

function failure(argv) {
  try { run(argv); } catch (e) { return e.message; }
  return null;
}

const addedId = (out) => out.replace("Added ", "");
const files = (list) => readdirSync(join(dir, list));
const saved = (list, id) => JSON.parse(readFileSync(join(dir, list, `${id}.json`), "utf8"));

test("create makes an empty list that lists shows with 0 pending", () => {
  expect(run(["create", "My App"])).toBe("Created my-app");
  expect(run(["lists"])).toBe("my-app\t0 pending");
});

test("create refuses a list that already exists", () => {
  run(["create", "app"]);
  expect(failure(["create", "App"])).toBe("List app already exists.");
});

test("lists with no folder says there are none", () => {
  process.env.TODOS_DIR = join(dir, "missing");
  expect(run(["lists"])).toBe("No lists yet.");
});

test("add writes one file holding the text", () => {
  run(["create", "app"]);
  const id = addedId(run(["add", "app", "buy milk"]));
  expect([files("app"), saved("app", id).text]).toEqual([[`${id}.json`], "buy milk"]);
});

test("list shows pending todos only, as number, id and first line", () => {
  run(["create", "app"]);
  const kept = addedId(run(["add", "app", "buy milk\nthe oat one"]));
  run(["done", "app", addedId(run(["add", "app", "call mom"]))]);
  expect(run(["list", "app"])).toBe(`#1  ${kept}  buy milk`);
});

test("list numbers pending todos newest first, as the window does", () => {
  run(["create", "app"]);
  const write = (id, createdAt) => writeFileSync(join(dir, "app", `${id}.json`),
    JSON.stringify({ id, text: id, done: false, createdAt, doneAt: null }));
  write("aaaaaaaa", "2026-01-01T00:00:00.000Z");
  write("bbbbbbbb", "2026-02-01T00:00:00.000Z");
  expect(run(["list", "app"])).toBe("#1  bbbbbbbb  bbbbbbbb\n#2  aaaaaaaa  aaaaaaaa");
});

test("done takes a short id and marks the todo done", () => {
  run(["create", "app"]);
  const id = addedId(run(["add", "app", "buy milk"]));
  run(["done", "app", id.slice(0, 4)]);
  expect([saved("app", id).done, run(["list", "app"])]).toEqual([true, "Nothing pending in app."]);
});

test("edit changes only the text", () => {
  run(["create", "app"]);
  const id = addedId(run(["add", "app", "buy milk"]));
  const before = saved("app", id);
  run(["edit", "app", id, "buy oat milk"]);
  expect(saved("app", id)).toEqual({ ...before, text: "buy oat milk" });
});

test("delete removes the file", () => {
  run(["create", "app"]);
  const id = addedId(run(["add", "app", "buy milk"]));
  run(["delete", "app", id]);
  expect(existsSync(join(dir, "app", `${id}.json`))).toBe(false);
});

test("add to a missing list says how to make it", () => {
  expect(failure(["add", "nope", "x"])).toBe("No list named nope. Run `lists`, or `create nope`.");
});

test("add with blank text is refused", () => {
  run(["create", "app"]);
  expect(failure(["add", "app", "  "])).toBe("Missing the todo text.");
});

test("done with an id no todo has is refused", () => {
  run(["create", "app"]);
  expect(failure(["done", "app", "zz"])).toBe("No single todo starts with zz. Run `list` to see ids.");
});

test("an unknown command lists the real ones", () => {
  expect(failure(["frob"])).toBe("Commands: lists, create, list, add, edit, done, delete");
});

test("lists counts only pending todos, lists in name order, and skips loose files", () => {
  run(["create", "zeta"]);
  run(["create", "alpha"]);
  run(["add", "alpha", "one"]);
  run(["done", "alpha", addedId(run(["add", "alpha", "two"]))]);
  writeFileSync(join(dir, "stray.json"), "{}");
  expect(run(["lists"])).toBe("alpha\t1 pending\nzeta\t0 pending");
});

test("list skips a file in the list that is not a todo", () => {
  run(["create", "app"]);
  writeFileSync(join(dir, "app", "junk.json"), "{nope");
  expect(run(["list", "app"])).toBe("Nothing pending in app.");
});

test("a todo file renamed away from its id is skipped, so delete never hits a missing file", () => {
  run(["create", "app"]);
  const id = addedId(run(["add", "app", "buy milk"]));
  renameSync(join(dir, "app", `${id}.json`), join(dir, "app", "copy.json"));
  expect(failure(["delete", "app", id])).toBe(`No single todo starts with ${id}. Run \`list\` to see ids.`);
});

test("delete with no id is refused, even when the list holds one todo", () => {
  run(["create", "app"]);
  const id = addedId(run(["add", "app", "buy milk"]));
  expect([failure(["delete", "app"]), existsSync(join(dir, "app", `${id}.json`))]).toEqual(["Missing the todo id.", true]);
});
