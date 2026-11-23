/** @typedef {{ id: string, text: string, done: boolean, createdAt: string, doneAt: string | null }} Todo */

export const ID_PATTERN = /^[a-z0-9]{8}$/;

/** A folder-safe list name, or "" when nothing is left. */
export function slug(name) {
  return String(name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

/** `id` and `now` come from the caller so tests can pin them. */
export function newTodo(text, { id, now }) {
  return { id, text: text.trim(), done: false, createdAt: now, doneAt: null };
}

export function withText(todo, text) {
  return { ...todo, text: text.trim() };
}

export function toggled(todo, now) {
  return todo.done ? { ...todo, done: false, doneAt: null } : { ...todo, done: true, doneAt: now };
}

/** Pending first, newest first inside each group. */
export function sorted(todos) {
  return [...todos].sort((a, b) => Number(a.done) - Number(b.done) || b.createdAt.localeCompare(a.createdAt));
}

export function pendingCount(todos) {
  return todos.filter((t) => !t.done).length;
}

/** The one todo whose id starts with `prefix`, else null. */
export function findById(todos, prefix) {
  const hits = todos.filter((t) => t.id.startsWith(prefix));
  return hits.length === 1 ? hits[0] : null;
}

export function randomId() {
  let id = "";
  while (id.length < 8) id += Math.floor(Math.random() * 36).toString(36);
  return id;
}

/** A parsed file is a todo only with these fields and types. */
export function isTodo(value) {
  return Boolean(value) && ID_PATTERN.test(value.id) && typeof value.text === "string"
    && typeof value.done === "boolean" && typeof value.createdAt === "string";
}
