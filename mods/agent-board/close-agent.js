import { div } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { closeOverlay, props, run, theme } from "herdr";

const CHOICES = [{ id: "cancel", label: "Cancel" }, { id: "close", label: "Close" }];

/** Asks before closing an agent: props { name, detail, command }; ←/→ choose and Enter picks. */
export class CloseAgent {
  constructor(cx) {
    this.at = 1;
    this.handle = cx.focus_handle();
    this.handle.focus();
  }

  pick(id) {
    const { overlay, command } = props();
    closeOverlay(overlay);
    if (id === "close") run(command.name, command.args);
  }

  key(e, cx) {
    if (e.key === "escape") return this.pick("cancel");
    if (e.key === "enter") return this.pick(CHOICES[this.at].id);
    if (e.key !== "left" && e.key !== "right") return;
    this.at = 1 - this.at;
    cx.stop_propagation();
    cx.notify();
  }

  button(c, i, t) {
    const on = i === this.at;
    return h_flex().id(`close-${c.id}`).h(32).px(14).items_center().rounded(8).border_1().cursor_pointer()
      .border_color(on ? t.accent : t.input).bg(on ? t.solid : t.raised).text_color(on ? t.solid_foreground : t.foreground)
      .on_click(() => this.pick(c.id)).child(c.label);
  }

  render() {
    const t = theme();
    return v_flex().id("close-agent").track_focus(this.handle).on_key_down((e, cx) => this.key(e, cx))
      .size_full().p(18).gap(12).bg(t.popover).text_size(13)
      .child(div().text_size(15).font_semibold().text_color(t.foreground).child(`Close ${props().name}?`))
      .child(div().flex_1().text_color(t.muted).child(props().detail))
      .child(h_flex().justify_end().gap(8).text_size(12).children(CHOICES.map((c, i) => this.button(c, i, t))));
  }
}
