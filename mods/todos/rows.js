import { div } from "gpui-kit";
import { h_flex, Input } from "gpui-base";

function checkbox(todo, { t, onToggle }) {
  return div().id(`check-${todo.id}`).flex_none().size(16).mt(2).rounded(4).border_1().cursor_pointer()
    .border_color(todo.done ? t.accent : t.input).bg(todo.done ? t.accent : t.background)
    .text_size(11).text_color(t.solid_foreground).flex().items_center().justify_center()
    .on_click(onToggle).child(todo.done ? "✓" : "");
}

/** Checkbox, text (click to edit), delete ×. `on` holds toggle, edit and remove. */
export function todoRow(todo, { t, on, editor }) {
  const text = editor
    ? Input.new(editor).flex_1().h(28).px(8).rounded(6).border_1().border_color(t.accent).bg(t.background).text_size(13)
    : div().id(`text-${todo.id}`).flex_1().min_w(0).text_size(13).cursor_pointer().on_click(on.edit)
      .text_color(todo.done ? t.dim : t.foreground).when(todo.done, (el) => el.line_through()).child(todo.text);
  return h_flex().id(`row-${todo.id}`).w_full().gap(10).px(10).py(6).items_start().rounded(6)
    .hover((s) => s.bg(t.raised))
    .child(checkbox(todo, { t, onToggle: on.toggle }))
    .child(text)
    .child(div().id(`del-${todo.id}`).flex_none().px(4).text_size(13).text_color(t.dim).cursor_pointer()
      .hover((s) => s.text_color(t.foreground)).on_click(on.remove).child("×"));
}

/** The floating count; renders nothing at 0 so Herdr hides the float. */
export function countBadge(count, { t, onOpen }) {
  if (!count) return div();
  return h_flex().id("todo-count").h(24).px(10).gap(6).items_center().cursor_pointer().on_click(onOpen)
    .child(div().size(8).rounded(4).bg(t.accent))
    .child(div().text_size(12).font_semibold().text_color(t.foreground).child(`${count} ${count === 1 ? "todo" : "todos"}`));
}
