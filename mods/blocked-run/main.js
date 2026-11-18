import { View, div } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { exec, hc, panes, run, settings, spaces, theme } from "herdr";
import { bangLine, forSpace, parseWaiting, queueOf, withoutItem } from "./waiting.js";

const READ_ALL = 'cat "$HOME"/.config/herdr-blocked/*.json 2>/dev/null';
// The terminal id and the record arrive as $1 and $2, never inside the script.
const WRITE_ONE = 'f="$HOME/.config/herdr-blocked/$1.json"; if [ -z "$2" ]; then rm -f "$f"; else printf "%s\\n" "$2" > "$f.tmp" && mv "$f.tmp" "$f"; fi';

function currentSpace() {
  const space = spaces().find((s) => s.active);
  if (!space) return { machine: null, addresses: [] };
  const tabs = new Set((space.tabs ?? []).map((t) => t.id));
  return { machine: space.machine ?? null, addresses: panes().filter((p) => p.terminal && tabs.has(p.tab)).map((p) => p.terminal) };
}

export default class BlockedRun extends View {
  init(_props, cx) {
    this.waiting = {};
    this.load(cx);
    cx.timer.every(2000, (cx) => this.load(cx));
  }

  load(cx) {
    const { machine } = currentSpace();
    if (this.loading) return;
    this.loading = true;
    cx.spawn(async (cx) => {
      const r = await exec("sh", ["-c", READ_ALL], { on: machine }).catch(() => null);
      this.waiting[machine ?? ""] = parseWaiting(r?.stdout ?? "");
      this.loading = false;
      cx.notify();
    });
  }

  // Run or Dismiss: the item leaves its terminal's queue on the machine.
  remove(item, machine, cx) {
    const all = this.waiting[machine ?? ""] ?? [];
    const queue = withoutItem(queueOf(all, item.terminal), item.index);
    const record = queue.length ? JSON.stringify({ terminal: item.terminal, queue }) : "";
    this.waiting[machine ?? ""] = all.filter((w) => w !== item);
    cx.notify();
    cx.spawn(async () => { await exec("sh", ["-c", WRITE_ONE, "sh", item.terminal, record], { on: machine }).catch(() => null); });
  }

  runIt(item, machine, cx) {
    const address = machine ? `${machine}/${item.terminal}` : item.terminal;
    cx.spawn(async () => { await hc(["send", address, bangLine(item.command)]); });
    run("pane.focus", { terminal: address });
    this.remove(item, machine, cx);
  }

  button(id, label, primary, t, onClick) {
    return h_flex().id(id).flex_none().h(28).px(14).items_center().rounded(7).cursor_pointer().text_size(12).font_semibold()
      .bg(primary ? t.solid : t.raised).text_color(primary ? t.solid_foreground : t.foreground)
      .border_1().border_color(primary ? t.solid : t.input).hover((s) => s.opacity(0.88)).on_click(onClick).child(label);
  }

  card(item, machine, t) {
    const key = `${item.terminal}-${item.index}`;
    const color = item.asked ? t.ansi3 : t.blocked;
    return v_flex().id(`cmd-${key}`).gap(8).p(12).rounded(10).bg(t.raised)
      .child(div().text_size(11).font_bold().text_color(color).child(item.asked ? "CLAUDE ASKS YOU TO RUN" : "AUTO MODE BLOCKED"))
      .child(div().text_size(12.5).font_family(settings().font_family).text_color(t.foreground).child(item.command))
      .child(h_flex().gap(8).justify_end()
        .child(this.button(`dismiss-${key}`, "Dismiss", false, t, (_e, cx) => this.remove(item, machine, cx)))
        .child(this.button(`run-${key}`, "Run it", true, t, (_e, cx) => this.runIt(item, machine, cx))));
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
