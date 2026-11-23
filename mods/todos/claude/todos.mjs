#!/usr/bin/env node
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { findById, isTodo, newTodo, randomId, slug, sorted, toggled, withText } from "./todo.js";

const root = () => process.env.TODOS_DIR ?? join(homedir(), ".config/todos");

function listDir(name) {
  const dir = join(root(), slug(name ?? ""));
  if (!slug(name ?? "") || !existsSync(dir)) {
    throw new Error(`No list named ${name}. Run \`lists\`, or \`create ${slug(name ?? "") || "<name>"}\`.`);
  }
  return dir;
}

function readTodos(dir) {
  return readdirSync(dir).filter((f) => f.endsWith(".json")).flatMap((f) => {
    try {
      const value = JSON.parse(readFileSync(join(dir, f), "utf8"));
      return isTodo(value) && f === `${value.id}.json` ? [value] : [];
    } catch {
      return [];
    }
  });
}

function save(dir, todo) {
  const file = join(dir, `${todo.id}.json`);
  writeFileSync(`${file}.tmp`, `${JSON.stringify(todo)}\n`);
  renameSync(`${file}.tmp`, file);
}

function pick(dir, prefix) {
  const todo = findById(readTodos(dir), prefix ?? "");
  if (!todo) throw new Error(`No single todo starts with ${prefix}. Run \`list\` to see ids.`);
  return todo;
}

function needText(text) {
  if (!text?.trim()) throw new Error("Missing the todo text.");
  return text;
}

const now = () => new Date().toISOString();

function lists() {
  if (!existsSync(root())) return "No lists yet.";
  const names = readdirSync(root(), { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort();
  const lines = names.map((n) => `${n}\t${readTodos(join(root(), n)).filter((t) => !t.done).length} pending`);
  return lines.join("\n") || "No lists yet.";
}

function create(name) {
  const dir = join(root(), slug(name ?? ""));
  if (!slug(name ?? "")) throw new Error("A list name needs letters or digits.");
  if (existsSync(dir)) throw new Error(`List ${slug(name)} already exists.`);
  mkdirSync(dir, { recursive: true });
  return `Created ${slug(name)}`;
}

function list(name) {
  const pending = sorted(readTodos(listDir(name))).filter((t) => !t.done);
  return pending.map((t) => `${t.id}  ${t.text.split("\n")[0]}`).join("\n") || `Nothing pending in ${slug(name)}.`;
}

const COMMANDS = {
  lists: () => lists(),
  create: ([name]) => create(name),
  list: ([name]) => list(name),
  add: ([name, text]) => {
    const todo = newTodo(needText(text), { id: randomId(), now: now() });
    save(listDir(name), todo);
    return `Added ${todo.id}`;
  },
  edit: ([name, id, text]) => {
    const dir = listDir(name), todo = pick(dir, id);
    save(dir, withText(todo, needText(text)));
    return `Edited ${todo.id}`;
  },
  done: ([name, id]) => {
    const dir = listDir(name), todo = pick(dir, id);
    if (!todo.done) save(dir, toggled(todo, now()));
    return `Done ${todo.id}`;
  },
  delete: ([name, id]) => {
    const dir = listDir(name), todo = pick(dir, id);
    rmSync(join(dir, `${todo.id}.json`));
    return `Deleted ${todo.id}`;
  },
};

/** Runs one command and returns what it prints. */
export function run(argv) {
  const command = COMMANDS[argv[0]];
  if (!command) throw new Error(`Commands: ${Object.keys(COMMANDS).join(", ")}`);
  return command(argv.slice(1));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    console.log(run(process.argv.slice(2)));
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
