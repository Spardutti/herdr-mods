import { View, div } from "gpui-kit";
import { v_flex, h_flex, InputState, Input } from "gpui-base";
import { checking, exec, focused, panes, props, run as runCommand, spaces, theme } from "herdr";
import { newTodo, pendingCount, randomId, slug, sorted, toggled, withText } from "./claude/todo.js";
import { READ_ALL, deleteCommand, parseAll, saveCommand } from "./disk.js";
import { projectName } from "./project.js";
import { countBadge, listBar, todoRow } from "./rows.js";

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

/** The list for the space's folder; undefined when git could not be asked, so the next load tries again. */
async function folderListAt(where) {
  if (!where.cwd) return null;
  const argv = ["rev-parse", "--path-format=absolute", "--git-common-dir"];
  const r = await exec("git", argv, where).catch(() => null);
  if (!r) return undefined;
  return slug(projectName(r.code === 0 ? r.stdout : undefined, where.cwd)) || null;
}

function newTracker() {
  let changes = 0;
  return { begin: () => changes, change: () => { changes += 1; }, isFresh: (seen) => seen === changes };
}

export default class Todos extends View {
  init(_props, cx) {
    this.countOnly = Boolean(props()?.count);
    this.lists = undefined;
    this.picked = null;
    this.editing = null;
    this.tracker = newTracker();
    this.writing = 0;
    this.addInput = InputState.new({ placeholder: "Add a todo, then Enter" });
    this.addInput.on("submit", (_e, cx) => this.add(cx));
    if (checking()) return;
    if (!this.countOnly) this.focusAdd(cx);
    this.load(cx);
    cx.timer.every(3000, (cx) => this.load(cx));
  }

  focusAdd(cx) {
    this.addInput.focus();
    cx.timer.after(600, () => this.addInput.focus());
  }

  load(cx) {
    const where = location(), key = JSON.stringify([where.cwd, where.on]);
    if (key !== this.key) this.moved(key);
    const seen = this.tracker.begin();
    cx.spawn(async (cx) => {
      if (this.folderList === undefined) {
        const name = await folderListAt(where);
        if (this.key === key) this.folderList = name;
      }
      const out = await run(READ_ALL, where);
      if (!this.tracker.isFresh(seen) || this.writing > 0) return;
      if (out !== undefined || this.lists === undefined) this.lists = parseAll(out);
      cx.notify();
    });
  }

  moved(key) {
    this.key = key;
    this.folderList = undefined;
    this.picked = null;
    this.editing = null;
    this.tracker.change();
  }

  write(argv, cx) {
    this.tracker.change();
    cx.notify();
    const where = location();
    this.writing += 1;
    cx.spawn(async (cx) => {
      await run(argv, where);
      this.writing -= 1;
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

  save(todo, cx) {
    const list = this.shownList();
    if (!list) return;
    list.todos = [todo, ...list.todos.filter((t) => t.id !== todo.id)];
    this.write(saveCommand(list.name, todo), cx);
  }

  add(cx) {
    const text = this.addInput.value().trim(), name = this.current();
    if (!text || !name) return;
    this.addInput.set_value("");
    if (!this.shownList()) this.lists = [...(this.lists ?? []), { name, todos: [] }];
    this.save(newTodo(text, { id: randomId(), now: new Date().toISOString() }), cx);
  }

  remove(todo, cx) {
    const list = this.shownList();
    if (!list) return;
    list.todos = list.todos.filter((t) => t.id !== todo.id);
    this.write(deleteCommand(list.name, todo.id), cx);
  }

  startEdit(todo, cx) {
    if (this.editing) this.finishEdit(cx);
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
    if (todo && text && text !== todo.text) this.save(withText(todo, text), cx);
    else cx.notify();
  }

  row(todo, t) {
    const on = {
      toggle: (_e, cx) => this.save(toggled(todo, new Date().toISOString()), cx),
      edit: (_e, cx) => this.startEdit(todo, cx),
      remove: (_e, cx) => this.remove(todo, cx),
    };
    const editor = this.editing?.id === todo.id ? this.editing.input : null;
    return todoRow(todo, { t, on, editor });
  }

  body(t) {
    const note = (text) => div().text_size(12.5).text_color(t.dim).child(text);
    if (this.lists === undefined) return note("Loading…");
    if (!this.current()) return note("Open a project folder, or pick a list above.");
    const rows = sorted(this.shownList()?.todos ?? []).map((todo) => this.row(todo, t));
    if (!rows.length) return note("Nothing here yet. Type a todo above, then Enter.");
    return v_flex().id("rows").w_full().flex_1().min_h(0).overflow_y_scroll().children(rows);
  }

  render(cx) {
    const t = theme(), { cwd, on } = location();
    if (JSON.stringify([cwd, on]) !== this.key && !checking()) this.load(cx);
    if (this.countOnly) {
      const onOpen = () => runCommand("mod.open", { name: "todos" });
      return countBadge(pendingCount(this.shownList()?.todos ?? []), { t, onOpen });
    }
    const pick = (name, cx) => { this.picked = name === this.folderList ? null : name; this.editing = null; cx.notify(); };
    return v_flex().id("todos").size_full().min_h(0).p(16).gap(10).bg(t.popover).text_color(t.foreground)
      .child(h_flex().items_center()
        .child(div().flex_1().text_size(11).font_bold().text_color(t.dim).child(`TODOS · ${this.current() ?? "no list"}`))
        .child(div().text_size(11).text_color(t.dim).child("Esc")))
      .child(listBar(this.lists ?? [], { t, current: this.current(), onPick: pick }))
      .child(Input.new(this.addInput).h(34).px(10).rounded(8).border_1().border_color(t.accent).bg(t.background).text_size(13))
      .child(this.body(t));
  }
}
