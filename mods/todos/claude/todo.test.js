import { test } from "node:test";
import { expect } from "../../../test-support/expect.js";
import { findById, isTodo, newTodo, randomId, slug, sorted, toggled, withText } from "./todo.js";

const todo = (over = {}) => ({ id: "abcd1234", text: "buy milk", done: false, createdAt: "2026-11-23T10:00:00Z", doneAt: null, ...over });

for (const [input, out] of [["Ultra Cruceros!", "ultra-cruceros"], ["../etc", "etc"], ["!!!", ""], ["app_2", "app-2"]]) {
  test(`slug: ${JSON.stringify(input)} → ${JSON.stringify(out)}`, () => expect(slug(input)).toBe(out));
}

test("newTodo trims the text and starts pending", () => {
  expect(newTodo("  buy milk ", { id: "abcd1234", now: "2026-11-23T10:00:00Z" })).toEqual(todo());
});

test("toggled on a pending todo marks it done at now", () => {
  expect(toggled(todo(), "2026-11-23T11:00:00Z")).toEqual(todo({ done: true, doneAt: "2026-11-23T11:00:00Z" }));
});

test("toggled on a done todo makes it pending and clears doneAt", () => {
  expect(toggled(todo({ done: true, doneAt: "2026-11-23T11:00:00Z" }), "x")).toEqual(todo());
});

test("withText trims the new text and keeps the rest", () => {
  expect(withText(todo(), " new ")).toEqual(todo({ text: "new" }));
});

test("sorted puts pending first, newest first inside each group", () => {
  const input = [todo({ id: "d", done: true, createdAt: "10" }), todo({ id: "p9", createdAt: "09" }), todo({ id: "p11", createdAt: "11" })];
  expect(sorted(input).map((t) => t.id)).toEqual(["p11", "p9", "d"]);
});

test("sorted leaves the input array in its first order", () => {
  const input = [todo({ id: "a", createdAt: "09" }), todo({ id: "b", createdAt: "11" })];
  sorted(input);
  expect(input.map((t) => t.id)).toEqual(["a", "b"]);
});

test("findById returns the one todo the prefix matches", () => {
  const hit = todo();
  expect(findById([hit, todo({ id: "zzzz0000" })], "abc")).toBe(hit);
});

test("findById returns null when the prefix matches two todos", () => {
  expect(findById([todo(), todo({ id: "abzz0000" })], "a")).toBe(null);
});

test("findById returns null when nothing matches", () => {
  expect(findById([todo()], "q")).toBe(null);
});

test("randomId gives 8 chars of [a-z0-9] every time", () => {
  const ids = Array.from({ length: 100 }, randomId);
  expect(ids.every((id) => /^[a-z0-9]{8}$/.test(id))).toBe(true);
});

for (const [what, bad] of [["an id that could leave the folder", { id: "../../x1" }], ["a number as text", { text: 5 }],
  ["a string as done", { done: "yes" }], ["no createdAt", { createdAt: undefined }]]) {
  test(`isTodo refuses ${what}`, () => expect(isTodo(todo(bad))).toBe(false));
}

test("isTodo refuses null", () => {
  expect(isTodo(null)).toBe(false);
});

test("sorted puts an older pending todo before a newer done one", () => {
  const input = [todo({ id: "d", done: true, createdAt: "12" }), todo({ id: "p", createdAt: "01" })];
  expect(sorted(input).map((t) => t.id)).toEqual(["p", "d"]);
});

test("isTodo accepts a whole todo", () => {
  expect(isTodo(todo())).toBe(true);
});
