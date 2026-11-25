import { div, svg } from "gpui-kit";
import { h_flex } from "gpui-base";
import { agents, focused, layout, openOverlay, panes, run, setShared, shared, theme, window } from "herdr";
import { ORDER, boardCards, filterCounts, shownView } from "./cards.js";
import { FILTER, LABELS as STATUS_LABELS } from "./board.js";
import { openChat, showBoard } from "./actions.js";

const LABELS = { all: "All", ...STATUS_LABELS };
const stop = (_e, cx) => cx.stop_propagation();

function pill(id, active, action) {
  const t = theme();
  return h_flex().id(id).h(36).px(16).gap(8).items_center().rounded(18).border_1().text_size(14).cursor_pointer()
    .border_color(active ? t.accent : t.border).bg(active ? t.selected : t.chrome).text_color(t.foreground)
    .hover((s) => s.bg(t.hover)).on_mouse_down("left", stop).on_click(action);
}

function windowButtons(t) {
  const w = window();
  if (!w?.buttons) return null;
  const icon = (name) => svg(`mods/tabs/${name}.svg`).size(16);
  const button = (id, name, cmd) => div().id(id).size(30).flex().items_center().justify_center().rounded(6).text_color(t.dim)
    .hover((s) => s.bg(t.hover).text_color(t.foreground)).on_mouse_down("left", stop).on_click(() => run(cmd)).child(icon(name));
  return h_flex().gap(2).child(button("win-min", "win-min", "window.minimize"))
    .child(button("win-max", w.maximized ? "win-restore" : "win-max", "window.maximize"))
    .child(button("win-close", "win-close", "window.close"));
}

function searchField(t) {
  return h_flex().id("search").flex_1().max_w(640).h(36).px(12).gap(8).items_center().rounded(8).border_1().border_color(t.border)
    .bg(t.input).text_color(t.dim).text_size(13).cursor_pointer().hover((s) => s.border_color(t.accent))
    .on_mouse_down("left", stop).on_click(() => openOverlay({ mod: "project-search" }))
    .child(svg("mods/workspace-chrome/search.svg").size(15)).child(div().flex_1().child("Open a project…"));
}

function filters(t) {
  const counts = filterCounts(agents()), current = shared(FILTER) ?? "all";
  return h_flex().gap(6).children(["all", ...ORDER].map((k) => pill(`filter-${k}`, current === k, () => setShared(FILTER, k))
    .child(div().size(8).rounded_full().bg(k === "all" ? t.muted : t[k]))
    .child(LABELS[k]).child(div().text_color(t.dim).child(String(counts[k])))));
}

function agentStrip(t) {
  const cards = boardCards(agents(), panes(), "all"), here = focused()?.pane;
  return h_flex().flex_1().min_w(0).gap(6).overflow_hidden().children(cards.map((c) => pill(`strip-${c.address}`, c.pane === here, () => openChat(c))
    .child(div().size(10).rounded_full().bg(t[c.status] ?? t.idle)).child(div().max_w(200).truncate().child(c.project))));
}

/** Header: on the board, project search and status filters; on a chat, ← Board and a strip of other agents. */
export function renderBar(view) {
  const t = theme();
  const onBoard = shownView(layout()) === "board";
  const row = h_flex().size_full().px(16).gap(14).items_center().bg(t.chrome).border_b_1().border_color(t.border)
    .when(window()?.platform === "macos" && !window()?.fullscreen, (el) => el.pl(80));
  if (!onBoard) {
    return row.child(pill("back", false, showBoard).child("← Board")).child(agentStrip(t));
  }
  return row.child(div().font_semibold().text_color(t.foreground).child("herdr"))
    .child(searchField(t)).child(filters(t)).children([windowButtons(t)].filter(Boolean));
}
