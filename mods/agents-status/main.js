import { View, div, svg } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { agents, nextCommand, run, setAgentOrder, theme } from "herdr";
import { age, byProject, displayName, firstNeedingYou, track } from "./status.js";

const LABELS = { done: "Done", blocked: "Blocked", working: "Working" };
// The person asked for orange; the theme has none, and no status uses it.
const FOCUS_ORANGE = "#f28c28";
const tint = (color) => (/^#[0-9a-f]{6}$/i.test(color ?? "") ? `${color}1f` : null);

export default class AgentsStatus extends View {
  init(_props, cx) {
    try { this.changed = JSON.parse(localStorage.getItem("changed") ?? "{}") ?? {}; } catch { this.changed = {}; }
    cx.timer.every(30000, (cx) => cx.notify());
    cx.spawn(async () => {
      for (;;) {
        const command = String(await nextCommand()).split(".").pop();
        const first = command === "needs" ? firstNeedingYou(agents(), this.changed) : null;
        if (first) run("pane.focus", { pane: first.pane });
      }
    });
  }

  remember(changed) {
    if (changed === this.changed) return;
    this.changed = changed;
    localStorage.setItem("changed", JSON.stringify(changed));
  }

  mark(status, color, t) {
    const box = div().flex_none().mt(4);
    if (status === "working") return box.child(svg("mods/workspace-chrome/spinner.svg").size(12).text_color(color).spin(900));
    if (status === "idle") return box.size(11).rounded(6).border_2().border_color(t.muted);
    return box.size(11).rounded(6).bg(color);
  }

  meta(a, t, now) {
    const word = LABELS[a.status], color = t[a.status] ?? t.muted;
    const text = word ?? age(now - (this.changed[a.address]?.at ?? now));
    return div().flex_none().text_size(13).text_color(word ? color : t.muted).when(Boolean(word), (el) => el.font_bold()).child(text);
  }

  row(a, t, now) {
    const color = t[a.status] ?? t.muted;
    return h_flex().id(`agent-${a.address}`).min_h(36).py(8).pr(8).pl(10).gap(8).items_start().rounded(8).cursor_pointer()
      .when(a.status !== "idle" && Boolean(tint(color)), (el) => el.bg(tint(color)))
      .border_2().border_color(a.focused ? FOCUS_ORANGE : "#00000000")
      .when(a.focused, (el) => el.bg(t.selected))
      .hover((s) => s.bg(t.hover))
      .on_click(() => run("pane.focus", { pane: a.pane }))
      .child(this.mark(a.status, color, t))
      .child(div().flex_1().min_w(0).text_size(13).text_color(t.foreground).child(displayName(a)))
      .child(this.meta(a, t, now));
  }

  project(p, t, now) {
    const count = p.members.length === 1 ? "1 chat" : `${p.members.length} chats`;
    return v_flex().id(`project-${p.id}`).mt(2).gap(2)
      .child(h_flex().mx(6).mb(2).pb(3).gap(8).items_end().border_b_1().border_color(t.border)
        .child(div().flex_1().min_w(0).text_size(14).font_bold().text_color(t.foreground).child(p.name))
        .child(div().flex_none().text_size(12).text_color(t.muted).child(count)))
      .children(p.members.map((a) => this.row(a, t, now)));
  }

  render() {
    const t = theme(), now = Date.now(), list = agents();
    this.remember(track(this.changed, list, now));
    const projects = byProject(list, this.changed);
    setAgentOrder(projects.flatMap((p) => p.members.map((a) => a.address)));
    return v_flex().size_full().min_h(0).bg(t.chrome)
      .child(v_flex().flex_1().min_h(0).px(8).pb(14).overflow_y_scrollbar()
        .when(!projects.length, (el) => el.child(div().px(8).pt(12).text_size(14).text_color(t.muted).child("No agents running. Start Claude in any terminal and it shows up here.")))
        .children(projects.map((p) => this.project(p, t, now))));
  }
}
