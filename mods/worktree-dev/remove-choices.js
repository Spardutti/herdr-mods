import { h_flex } from "gpui-base";

const LABELS = { remove: "Remove worktree", keep: "Close agent only", cancel: "Cancel" };

/** The remove dialog's choices; remove is left out once the folder is known not to be a worktree. */
export function removeChoices(repo, keep) {
  const removable = repo === undefined || Boolean(repo?.linked);
  return [removable && "remove", keep && "keep", "cancel"].filter(Boolean);
}

export function choiceButtons(t, list, at, pick) {
  return h_flex().justify_end().gap(8).text_size(12).children(list.map((id, i) =>
    h_flex().id(`choice-${id}`).h(30).px(12).items_center().rounded(6).border_1().cursor_pointer()
      .border_color(i === at ? t.accent : t.input).bg(i === at ? t.solid : t.raised).text_color(i === at ? t.solid_foreground : t.foreground)
      .hover((s) => s.bg(t.hover)).on_click((_e, cx) => pick(id, cx)).child(LABELS[id])));
}
