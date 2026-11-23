import { View, div } from "gpui-kit";
import { v_flex, h_flex, InputState, Input } from "gpui-base";
import { checking, exec, focused, panes, spaces, theme } from "herdr";
import { newTodo, randomId, slug, sorted, toggled, withText } from "./claude/todo.js";
import { READ_ALL, createListCommand, deleteCommand, parseAll, saveCommand } from "./disk.js";
import { projectName } from "./project.js";
import { listBar, noList, todoRow } from "./rows.js";

// The focused space's folder and machine, as Herdr's changes mod finds them.
function location() {
  const space = spaces().find((s) => s.active), f = focused();
  const pane = f?.pane ? panes().find((p) => p.pane === f.pane) : null;
  return { cwd: pane?.cwd || f?.cwd || space?.folder, on: space?.machine ?? null };
}

const run = async (argv, { cwd, on }) => {
  const r = await exec(argv[0], argv.slice(1), { cwd, on }).catch(() => null);
  return r?.code === 0 ? r.stdout : undefined;
};

function newTracker() {
  let changes = 0;
  return { begin: () => changes, change: () => { changes += 1; }, isFresh: (seen) => seen === changes };
}

export default class Todos extends View {
  init(_props, cx) {
    this.lists = undefined;
    this.picked = null;
    this.editing = null;
    this.tracker = newTracker();
    this.addInput = InputState.new({ placeholder: "Add a todo, then Enter" });
    this.addInput.on("submit", (_e, cx) => this.add(cx));
    if (checking()) return;
    this.addInput.focus();
    cx.timer.after(600, () => this.addInput.focus());
    this.load(cx);
    cx.timer.every(3000, (cx) => this.load(cx));
  }

  load(cx) {
    const where = location(), key = JSON.stringify([where.cwd, where.on]);
    if (key !== this.key) { this.key = key; this.folderList = undefined; this.tracker.change(); }
    const seen = this.tracker.begin();
    cx.spawn(async (cx) => {
      if (this.folderList === undefined) await this.findFolderList(where);
      const out = await run(READ_ALL, where);
      if (!this.tracker.isFresh(seen)) return;
      if (out !== undefined || this.lists === undefined) this.lists = parseAll(out);
      cx.notify();
    });
  }

  async findFolderList(where) {
    if (!where.cwd) { this.folderList = null; return; }
    const commonDir = await run(["git", "rev-parse", "--path-format=absolute", "--git-common-dir"], where);
    this.folderList = slug(projectName(commonDir, where.cwd)) || null;
  }

  write(argv, cx) {
    this.tracker.change();
    cx.notify();
    const where = location();
    cx.spawn(async (cx) => {
      await run(argv, where);
      this.tracker.change();
      this.load(cx);
    });
  }

  current() {
    return this.picked ?? this.folderList ?? null;
  }

  shownList() {
    return this.lists?.find((l) => l.name === this.current()) ?? null;
  }

  replace(todo) {
    const list = this.shownList();
    list.todos = [todo, ...list.todos.filter((t) => t.id !== todo.id)];
    return saveCommand(list.name, todo);
  }

  add(cx) {
    const text = this.addInput.value().trim(), list = this.shownList();
    if (!text || !list) return;
    this.addInput.set_value("");
    this.write(this.replace(newTodo(text, { id: randomId(), now: new Date().toISOString() })), cx);
  }

  create(cx) {
    const name = this.current();
    this.lists = [...this.lists, { name, todos: [] }];
    this.write(createListCommand(name), cx);
  }

  remove(todo, cx) {
    const list = this.shownList();
    list.todos = list.todos.filter((t) => t.id !== todo.id);
    this.write(deleteCommand(list.name, todo.id), cx);
  }

  startEdit(todo, cx) {
    const input = InputState.new({ value: todo.text });
    input.on("submit", (_e, cx) => this.finishEdit(cx));
    input.focus();
    this.editing = { id: todo.id, input };
    cx.notify();
  }

  finishEdit(cx) {
    const { id, input } = this.editing, text = input.value().trim();
    const todo = this.shownList()?.todos.find((t) => t.id === id);
    this.editing = null;
    if (todo && text && text !== todo.text) this.write(this.replace(withText(todo, text)), cx);
    else cx.notify();
  }

  row(todo, t) {
    const on = {
      toggle: (_e, cx) => this.write(this.replace(toggled(todo, new Date().toISOString())), cx),
      edit: (_e, cx) => this.startEdit(todo, cx),
      remove: (_e, cx) => this.remove(todo, cx),
    };
    const editor = this.editing?.id === todo.id ? this.editing.input : null;
    return todoRow(todo, { t, on, editor });
  }

  body(t) {
    const note = (text) => div().text_size(12.5).text_color(t.dim).child(text);
    if (this.lists === undefined) return note("Loading…");
    const current = this.current(), list = this.shownList();
    if (!current) return note("Open a project folder, or pick a list above.");
    if (!list) return noList(current, { t, onCreate: (_e, cx) => this.create(cx) });
    const rows = sorted(list.todos).map((todo) => this.row(todo, t));
    return v_flex().w_full().flex_1().min_h(0).gap(8)
      .child(Input.new(this.addInput).h(34).px(10).rounded(8).border_1().border_color(t.input).bg(t.background).text_size(13))
      .child(rows.length ? v_flex().id("rows").flex_1().min_h(0).overflow_y_scroll().children(rows) : note("Nothing here yet."));
  }

  render(cx) {
    const t = theme(), { cwd, on } = location();
    if (JSON.stringify([cwd, on]) !== this.key && !checking()) this.load(cx);
    const pick = (name, cx) => { this.picked = name === this.folderList ? null : name; this.editing = null; cx.notify(); };
    return v_flex().id("todos").size_full().min_h(0).p(16).gap(10).bg(t.popover).text_color(t.foreground)
      .child(h_flex().items_center()
        .child(div().flex_1().text_size(11).font_bold().text_color(t.dim).child(`TODOS · ${this.current() ?? "no list"}`))
        .child(div().text_size(11).text_color(t.dim).child("Esc")))
      .child(listBar(this.lists ?? [], { t, current: this.current(), onPick: pick }))
      .child(this.body(t));
  }
}
