import { div, svg } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { agents, panes, settings, shared, theme } from "herdr";
import { boardCards, moveSelection } from "./cards.js";
import { newAgent, newWorktreeAgent, openChat } from "./actions.js";

export const FILTER = "agent-board.filter";
export const LABELS = { blocked: "Needs you", done: "Done", working: "Working", idle: "Idle" };
const stop = (_e, cx) => cx.stop_propagation();
const tint = (color) => (/^#[0-9a-f]{6}$/i.test(color ?? "") ? `${color}24` : null);

function chip(id, text, color) {
  const t = theme();
  return div().id(id).px(8).py(2).rounded(4).bg(t.raised).text_size(12).text_color(color).truncate().child(text);
}

function dot(status, t) {
  if (status === "working") return svg("mods/workspace-chrome/spinner.svg").size(11).text_color(t.working).spin(900);
  return div().size(10).flex_none().rounded_full().bg(t[status] ?? t.idle);
}

function cardButton(id, label, action) {
  const t = theme();
  return div().id(id).flex_1().h(30).flex().items_center().justify_center().rounded(6).border_1().border_color(t.border)
    .text_size(12).text_color(t.muted).cursor_pointer().hover((s) => s.bg(t.hover).text_color(t.foreground))
    .on_mouse_down("left", stop).on_click((_e, cx) => { cx.stop_propagation(); action(); }).child(label);
}

function cardHead(card, t) {
  const quiet = card.status === "idle";
  return h_flex().gap(8).items_center().child(dot(card.status, t))
    .child(div().flex_1().min_w(0).truncate().font_semibold().text_color(t.foreground).child(card.project))
    .child(div().text_size(12).font_semibold().text_color(quiet ? t.muted : t[card.status]).child(LABELS[card.status]));
}

/** One card, colored by status: project, agent, branch, title; click opens the chat; + Agent and + worktree buttons. */
export function renderCard(card, t, selected) {
  const key = card.address, color = t[card.status] ?? t.idle;
  const branch = card.branch ? `${card.worktree ? "⑂ " : ""}${card.branch}` : null;
  const lit = card.status !== "idle" && Boolean(tint(color));
  const body = v_flex().id(`card-${key}`).w(340).rounded(10).border_2().overflow_hidden()
    .border_color(card.status === "idle" ? t.border : color).bg(t.surface)
    .child(v_flex().id(`open-${key}`).gap(8).px(14).py(12).cursor_pointer().when(lit, (el) => el.bg(tint(color)))
      .hover((s) => s.bg(t.hover)).on_click(() => openChat(card))
      .child(cardHead(card, t))
      .child(h_flex().gap(6).child(chip(`agent-${key}`, card.agent, t.muted))
        .when(Boolean(branch), (el) => el.child(chip(`branch-${key}`, branch, card.worktree ? t.accent : t.muted))))
      .child(div().h(40).overflow_hidden().text_size(13).text_color(card.status === "blocked" ? t.foreground : t.muted).child(card.title)))
    .child(h_flex().gap(6).px(10).py(8).border_t_1().border_color(t.border).bg(t.chrome)
      .child(cardButton(`new-${key}`, "+ Agent", () => newAgent(card.space, card.machine)))
      .child(cardButton(`wt-${key}`, "+ Agent in worktree", () => newWorktreeAgent(card.space, card.cwd, card.machine))));
  return selectionRing(key, selected, t).child(body);
}

// A ring outside the card, so it never hides or competes with the status border.
function selectionRing(key, selected, t) {
  return div().id(`ring-${key}`).flex_none().p(3).rounded(14).border_2().border_color(selected ? t.foreground : "#00000000");
}

const EMPTY = "No agents running. Press Ctrl+K, pick a project and press Ctrl+Enter to start Claude there.";

const CARD_STEP = 340 + 2 * 3 + 2 * 2 + 10;
const NAV_KEYS = new Set(["left", "right", "up", "down", "enter"]);

function onKey(view, cards) {
  return (e, cx) => {
    if (!NAV_KEYS.has(e.key) || e.modifiers.control || e.modifiers.alt) return;
    if (e.key === "enter" && cards[view.at]) openChat(cards[view.at]);
    else view.at = moveSelection(view.at, e.key, { count: cards.length, cols: view.cols });
    cx.stop_propagation();
    cx.notify();
  };
}

/** Every card in one grid that keeps its place; the status shows as color. Arrows move, Enter opens. */
export function renderBoard(view) {
  const t = theme();
  const cards = boardCards(agents(), panes(), shared(FILTER) ?? "all");
  view.at = Math.min(view.at, Math.max(cards.length - 1, 0));
  const focused = view.handle.is_focused();
  return v_flex().id("agent-board").size_full().min_h(0).bg(t.canvas)
    .track_focus(view.handle).on_key_down(onKey(view, cards))
    .on_size_change((size) => { view.cols = Math.max(1, Math.floor((size.width / settings().zoom - 48 + 10) / CARD_STEP)); })
    .child(v_flex().id("board-scroll").flex_1().min_h(0).p(24).overflow_y_scrollbar()
      .when(!cards.length, (el) => el.child(div().text_size(14).text_color(t.muted).child(EMPTY)))
      .child(h_flex().flex_wrap().items_start().gap(10).children(cards.map((c, i) => renderCard(c, t, focused && i === view.at)))));
}
