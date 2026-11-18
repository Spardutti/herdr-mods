import { View, div, svg } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { agents, nextCommand, run, setAgentOrder, theme } from "herdr";
import { age, bySpace, displayName, firstNeedingYou, grouped, track } from "./status.js";

const LABELS = { done: "Done", blocked: "Blocked" };
const tint = (color) => (/^#[0-9a-f]{6}$/i.test(color ?? "") ? `${color}1f` : null);

function groupColor(g, t) {
  if (g.id === "working") return t.working;
  if (g.id === "idle") return t.dim;
  return g.members.some((a) => a.status === "blocked") ? t.blocked : t.done;
}

export default class AgentsStatus extends View {
  init(_props, cx) {
    try { this.changed = JSON.parse(localStorage.getItem("changed") ?? "{}") ?? {}; } catch { this.changed = {}; }
    cx.timer.every(30000, (cx) => cx.notify());
    cx.spawn(async () => {
      for (;;) {
        const command = String(await nextCommand()).split(".").pop();
        const first = command === "needs" ? firstNeedingYou(agents()) : null;
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
    if (status === "working") return svg("mods/workspace-chrome/spinner.svg").size(12).flex_none().text_color(color).spin(900);
    if (status === "idle") return div().size(8).flex_none().rounded(4).border_1().border_color(t.dim);
    return div().size(8).flex_none().rounded(4).bg(color);
  }

  header(g, t) {
    return div().id(`group-${g.id}`).pt(8).px(8).text_size(11).font_bold().text_color(groupColor(g, t))
      .child(`${g.label} · ${g.members.length}`);
  }

  row(a, t, now) {
    const busy = a.status !== "idle";
    const color = t[a.status] ?? t.dim;
    const since = age(now - (this.changed[a.address]?.at ?? now));
    const name = div().truncate().text_color(busy ? t.foreground : t.muted).when(busy, (el) => el.font_semibold()).child(displayName(a));
    const space = div().truncate().text_size(11.5).text_color(t.dim).child(a.space_name);
    return h_flex().id(`agent-${a.address}`).h(busy ? 42 : 30).px(10).gap(10).items_center().rounded(8).cursor_pointer()
      .when(busy && Boolean(tint(color)), (el) => el.bg(tint(color)))
      .border_2().border_color(a.focused ? t.accent : "#00000000")
      .when(a.focused, (el) => el.bg(t.selected))
      .hover((s) => s.bg(t.hover))
      .on_click(() => run("pane.focus", { pane: a.pane }))
      .child(this.mark(a.status, color, t))
      .child(busy ? v_flex().flex_1().min_w(0).child(name).child(space) : h_flex().flex_1().min_w(0).child(name))
      .child(div().flex_none().text_size(11.5).text_color(busy ? color : t.dim).when(busy, (el) => el.font_semibold()).child(LABELS[a.status] ?? since));
  }

  spaceLabel(s, t) {
    return div().id(`space-${s.id}`).pt(6).px(10).text_size(11.5).text_color(t.dim).truncate().child(s.name);
  }

  rows(g, t, now) {
    if (g.id !== "idle") return g.members.map((a) => this.row(a, t, now));
    return g.spaces.flatMap((s) => [this.spaceLabel(s, t), ...s.members.map((a) => this.row(a, t, now))]);
  }

  render() {
    const t = theme(), now = Date.now(), list = agents();
    this.remember(track(this.changed, list, now));
    const groups = grouped(list).map((g) => (g.id === "idle" ? { ...g, spaces: bySpace(g.members) } : g));
    setAgentOrder(groups.flatMap((g) => (g.spaces ? g.spaces.flatMap((s) => s.members) : g.members).map((a) => a.address)));
    return v_flex().size_full().min_h(0).bg(t.chrome).text_size(13)
      .child(h_flex().h(31).pl(16).items_center().text_size(11.5).text_color(t.dim).child("Agents"))
      .child(v_flex().flex_1().min_h(0).px(8).pb(14).gap(4).overflow_y_scrollbar()
        .when(!groups.length, (el) => el.child(div().px(8).text_color(t.dim).child("No agents yet.")))
        .children(groups.flatMap((g) => [this.header(g, t), ...this.rows(g, t, now)])));
  }
}
