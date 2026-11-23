import { test } from "node:test";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect } from "../../test-support/expect.js";
import { READ_ALL, deleteCommand, parseAll, saveCommand } from "./disk.js";

const todo = (over = {}) => ({ id: "abcd1234", text: "buy milk", done: false, createdAt: "2026-11-23T10:00:00Z", doneAt: null, ...over });

function runIn(home, argv) {
  return execFileSync(argv[0], argv.slice(1), { env: { ...process.env, HOME: home }, encoding: "utf8" });
}

const tempHome = () => mkdtempSync(join(tmpdir(), "todos-"));

test("parseAll groups todos under their list and sorts lists by name", () => {
  const out = `L\tbeta\nL\talpha\nT\talpha\tabcd1234\t${JSON.stringify(todo())}\n`;
  expect(parseAll(out)).toEqual([{ name: "alpha", todos: [todo()] }, { name: "beta", todos: [] }]);
});

test("parseAll skips a todo line whose json does not parse", () => {
  expect(parseAll("L\tapp\nT\tapp\tabcd1234\t{nope\n")).toEqual([{ name: "app", todos: [] }]);
});

test("parseAll skips a file that is json but not a todo", () => {
  expect(parseAll('L\tapp\nT\tapp\tx\t{"id":"x"}\n')).toEqual([{ name: "app", todos: [] }]);
});

test("parseAll of empty output is no lists", () => {
  expect(parseAll("")).toEqual([]);
});

test("saveCommand passes the list, id and json as arguments, not inside the script", () => {
  const argv = saveCommand("My App", todo({ text: '"; rm -rf ~' }));
  expect(argv.slice(3)).toEqual(["sh", "my-app", "abcd1234", JSON.stringify(todo({ text: '"; rm -rf ~' }))]);
  expect(argv[2].includes("rm -rf")).toBe(false);
});

test("saveCommand refuses an id that could leave the folder", () => {
  let message;
  try { saveCommand("app", todo({ id: "../../x1" })); } catch (e) { message = e.message; }
  expect(message).toBe("Bad todo id");
});

test("saveCommand refuses a list name with no letters or digits", () => {
  let message;
  try { saveCommand("!!!", todo()); } catch (e) { message = e.message; }
  expect(message).toBe("Bad list name");
});

test("saveCommand writes the todo as one line of json", () => {
  const home = tempHome();
  runIn(home, saveCommand("app", todo()));
  expect(readFileSync(join(home, ".config/todos/app/abcd1234.json"), "utf8")).toBe(`${JSON.stringify(todo())}\n`);
});

test("deleteCommand removes only that todo's file", () => {
  const home = tempHome();
  runIn(home, saveCommand("app", todo()));
  runIn(home, saveCommand("app", todo({ id: "zzzz0000" })));
  runIn(home, deleteCommand("app", "abcd1234"));
  expect([existsSync(join(home, ".config/todos/app/abcd1234.json")), existsSync(join(home, ".config/todos/app/zzzz0000.json"))]).toEqual([false, true]);
});

test("READ_ALL reads back saved todos and empty lists", () => {
  const home = tempHome();
  runIn(home, saveCommand("app", todo()));
  mkdirSync(join(home, ".config/todos/empty"), { recursive: true });
  expect(parseAll(runIn(home, READ_ALL))).toEqual([{ name: "app", todos: [todo()] }, { name: "empty", todos: [] }]);
});

test("READ_ALL with no todos folder prints nothing", () => {
  expect(runIn(tempHome(), READ_ALL)).toBe("");
});

test("READ_ALL skips a non-json file in a list", () => {
  const home = tempHome();
  mkdirSync(join(home, ".config/todos/app"), { recursive: true });
  writeFileSync(join(home, ".config/todos/app/notes.txt"), "hi");
  expect(runIn(home, READ_ALL)).toBe("L\tapp\n");
});

test("parseAll skips a todo whose list line never came", () => {
  expect(parseAll(`T\tghost\tabcd1234\t${JSON.stringify(todo())}\n`)).toEqual([]);
});

test("READ_ALL skips a todo file whose name is not its id", () => {
  const home = tempHome();
  runIn(home, saveCommand("app", todo()));
  writeFileSync(join(home, ".config/todos/app/copy.json"), JSON.stringify(todo()));
  expect(parseAll(runIn(home, READ_ALL))).toEqual([{ name: "app", todos: [todo()] }]);
});
