import { div, svg } from "gpui-kit";
import { v_flex, h_flex, InputState, Input } from "gpui-base";
import { agents, closeOverlay, panes, props, theme } from "herdr";
import { boardCards, matchCards } from "./cards.js";
import { LABELS } from "./board.js";
import { openChat } from "./actions.js";

/** The Ctrl+P pop-up: type to filter open agents, ↑/↓ to move, Enter to open the chat. */
export class AgentSearch {
  constructor(cx) {
    this.at = 0;
    this.handle = cx.focus_handle();
    this.input = InputState.new({ placeholder: "Find an agent…" });
    this.input.on("change", (_e, cx) => { this.at = 0; cx.notify(); });
    this.input.on("submit", () => this.go(this.matches()[this.at]));
    this.input.focus();
  }

  matches() {
    return matchCards(boardCards(agents(), panes(), "all"), this.input.value());
  }

  go(card) {
    if (!card) return;
    closeOverlay(props().overlay);
    openChat(card);
  }

  move(e, cx, count) {
    if (e.key === "escape") return closeOverlay(props().overlay);
    if (e.key === "down") this.at = Math.min(this.at + 1, count - 1);
    else if (e.key === "up") this.at = Math.max(this.at - 1, 0);
    else return;
    cx.stop_propagation();
    cx.notify();
  }

  row(c, i, t) {
    const color = c.status === "idle" ? t.muted : t[c.status];
    return h_flex().id(`find-${c.address}`).h(44).px(10).gap(10).items_center().rounded(6).cursor_pointer()
      .when(i === this.at, (el) => el.bg(t.selected)).hover((s) => s.bg(t.hover)).on_click(() => this.go(c))
      .child(div().size(10).flex_none().rounded_full().bg(t[c.status] ?? t.idle))
      .child(div().flex_1().min_w(0).child(div().text_color(t.foreground).truncate().child(c.project))
        .child(div().text_size(11).text_color(t.dim).truncate().child(c.title)))
      .child(div().text_size(12).font_semibold().text_color(color).child(LABELS[c.status]));
  }

  render() {
    const t = theme(), list = this.matches();
    this.at = Math.min(this.at, Math.max(list.length - 1, 0));
    return v_flex().id("agent-search").track_focus(this.handle).size_full().min_h(0).p(14).gap(10).bg(t.popover).text_size(13)
      .on_key_down((e, cx) => this.move(e, cx, list.length))
      .child(h_flex().h(36).flex_none().px(10).gap(8).items_center().rounded(8).border_1().border_color(t.accent).bg(t.background)
        .child(svg("mods/workspace-chrome/search.svg").size(15).text_color(t.dim))
        .child(Input.new(this.input).flex_1().h_full().text_color(t.foreground)))
      .child(v_flex().id("find-list").flex_1().min_h(0).gap(2).overflow_y_scrollbar()
        .when(!list.length, (el) => el.child(div().px(10).py(8).text_color(t.dim).child("No agent matches.")))
        .children(list.map((c, i) => this.row(c, i, t))));
  }
}
