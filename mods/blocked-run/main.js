import { View, div } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { checking, exec, hc, notify, panes, run, settings, spaces, theme } from "herdr";
import { DROP_SCRIPT, bangLine, forSpace, newTracker, parseWaiting, runThenDrop } from "./waiting.js";

const READ_ALL = 'cat "$HOME"/.config/herdr-blocked/*.json 2>/dev/null';

function currentSpace() {
  const space = spaces().find((s) => s.active);
  if (!space) return { machine: null, addresses: [] };
  const tabs = new Set((space.tabs ?? []).map((t) => t.id));
  return { machine: space.machine ?? null, addresses: panes().filter((p) => p.terminal && tabs.has(p.tab)).map((p) => p.terminal) };
}

export default class BlockedRun extends View {
  init(_props, cx) {
    this.waiting = {};
    this.tracker = newTracker();
    if (checking()) return;
    this.load(cx);
    cx.timer.every(2000, (cx) => this.load(cx));
  }

  load(cx) {
    const { machine } = currentSpace();
    if (this.loading) return;
    this.loading = true;
    const seen = this.tracker.begin();
    cx.spawn(async (cx) => {
      const r = await exec("sh", ["-c", READ_ALL], { on: machine }).catch(() => null);
      if (this.tracker.isFresh(seen)) this.waiting[machine ?? ""] = parseWaiting(r?.stdout ?? "");
      this.loading = false;
      cx.notify();
    });
  }

  // Hidden at once, so a second click can't run it again; any check already under way is ignored.
  hide(item, machine) {
    this.tracker.change();
    this.waiting[machine ?? ""] = (this.waiting[machine ?? ""] ?? []).filter((w) => w !== item);
  }

  drop(item, machine) {
    return exec("python3", ["-I", "-c", DROP_SCRIPT, item.terminal, item.command], { on: machine })
      .catch(() => null).finally(() => this.tracker.change());
  }

  dismiss(item, machine, cx) {
    this.hide(item, machine);
    cx.notify();
    cx.spawn(async (cx) => { await this.drop(item, machine); cx.notify(); });
  }

  runIt(item, machine, cx) {
    const address = machine ? `${machine}/${item.terminal}` : item.terminal;
    this.hide(item, machine);
    cx.notify();
    cx.spawn(async (cx) => {
      const send = (i) => hc(["send", address, bangLine(i.command)]);
      if (await runThenDrop(send, (i) => this.drop(i, machine), item)) run("pane.focus", { terminal: address });
      else notify({ title: "Couldn't run the command", body: "Its terminal didn't take it, so it stays in the list.", level: "error" });
      this.tracker.change();
      cx.notify();
    });
  }

  buttonShape({ id, label, onClick }) {
    return h_flex().id(id).flex_none().h(28).px(14).items_center().rounded(7).cursor_pointer().text_size(12).font_semibold()
      .border_1().hover((s) => s.opacity(0.88)).on_click(onClick).child(label);
  }

  primaryButton(t, button) {
    return this.buttonShape(button).bg(t.solid).text_color(t.solid_foreground).border_color(t.solid);
  }

  plainButton(t, button) {
    return this.buttonShape(button).bg(t.raised).text_color(t.foreground).border_color(t.input);
  }

  card(item, machine, t) {
    const key = `${item.terminal}-${item.index}`;
    const color = item.asked ? t.ansi3 : t.blocked;
    return v_flex().id(`cmd-${key}`).gap(8).p(12).rounded(10).bg(t.raised)
      .child(div().text_size(11).font_bold().text_color(color).child(item.asked ? "CLAUDE ASKS YOU TO RUN" : "AUTO MODE BLOCKED"))
      .child(div().text_size(12.5).font_family(settings().font_family).text_color(t.foreground).child(item.command))
      .child(h_flex().gap(8).justify_end()
        .child(this.plainButton(t, { id: `dismiss-${key}`, label: "Dismiss", onClick: (_e, cx) => this.dismiss(item, machine, cx) }))
        .child(this.primaryButton(t, { id: `run-${key}`, label: "Run it", onClick: (_e, cx) => this.runIt(item, machine, cx) })));
  }

  render() {
    const t = theme(), { machine, addresses } = currentSpace();
    const shown = forSpace(this.waiting[machine ?? ""] ?? [], addresses, machine);
    return v_flex().size_full().min_h(0).bg(t.chrome).px(16).pt(10).gap(8).text_size(13).overflow_y_scrollbar()
      .child(div().text_size(11).font_bold().text_color(t.dim).child("COMMANDS"))
      .when(!shown.length, (el) => el.child(div().text_size(12.5).text_color(t.dim).child("Nothing waiting.")))
      .children(shown.map((item) => this.card(item, machine, t)));
  }
}
