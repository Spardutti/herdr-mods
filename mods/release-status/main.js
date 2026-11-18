import { View, div } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { exec, focused, panes, spaces, theme } from "herdr";
import { BASE, RELEASE, releaseStatus } from "./release.js";

// The focused space's folder and machine, as Herdr's changes mod finds them.
function location() {
  const space = spaces().find((s) => s.active), f = focused();
  const pane = f?.pane ? panes().find((p) => p.pane === f.pane) : null;
  return { cwd: pane?.cwd || f?.cwd || space?.folder, on: space?.machine ?? null, name: space?.name ?? "" };
}

const tint = (color) => (/^#[0-9a-f]{6}$/i.test(color ?? "") ? `${color}1f` : null);
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

export default class ReleaseStatus extends View {
  init(_props, cx) {
    this.status = null;
    this.refresh(cx);
    cx.timer.every(30000, (cx) => this.refresh(cx));
  }

  refresh(cx) {
    const { cwd, on } = location(), key = JSON.stringify([cwd, on]);
    if (key !== this.key) { this.key = key; this.status = null; this.loading = false; }
    if (!cwd || this.loading) return;
    this.loading = true;
    cx.spawn(async (cx) => {
      const git = async (args) => {
        const r = await exec("git", ["--no-optional-locks", ...args], { cwd, on }).catch(() => null);
        return r?.code === 0 ? r.stdout : undefined;
      };
      const status = await releaseStatus(git);
      if (key === this.key) { this.status = status; this.loading = false; }
      cx.notify();
    });
  }

  note(text, color) {
    return div().text_size(12.5).text_color(color).child(text);
  }

  waiting(merges, t) {
    const color = t.ansi3;
    return v_flex().gap(8).p(12).rounded(10).when(Boolean(tint(color)), (el) => el.bg(tint(color)))
      .child(h_flex().gap(8).items_end()
        .child(div().text_size(22).font_bold().text_color(color).child(String(merges.length)))
        .child(div().flex_1().font_semibold().text_color(t.foreground).child("waiting to release"))
        .child(div().text_size(11.5).text_color(t.muted).child(`${RELEASE} → ${BASE}`)))
      .child(v_flex().gap(5).children(merges.map((m, i) =>
        div().id(`merge-${i}`).truncate().text_size(12.5).text_color(t.muted).child(`· ${m}`))));
  }

  released(t) {
    return h_flex().gap(8).p(12).rounded(10).items_center().bg(t.raised)
      .child(div().text_color(t.ansi2).font_bold().child("✓"))
      .child(div().flex_1().font_semibold().text_color(t.foreground).child("All released"))
      .child(div().text_size(11.5).text_color(t.muted).child(`${RELEASE} = ${BASE}`));
  }

  body(t) {
    const s = this.status;
    if (!s) return this.note("Checking…", t.dim);
    if (s.error) return this.note(s.error, t.dim);
    if (!s.release) return this.note(`No ${RELEASE} branch here, so nothing to release.`, t.dim);
    const { merges, behind } = s.release;
    return v_flex().gap(8)
      .child(merges.length ? this.waiting(merges, t) : this.released(t))
      .when(behind > 0, (el) => el.child(this.note(`${BASE} has ${plural(behind, "commit")} ${RELEASE} lacks: merge ${BASE} into ${RELEASE}.`, t.blocked)));
  }

  render(cx) {
    const t = theme(), { cwd, on, name } = location();
    if (JSON.stringify([cwd, on]) !== this.key) this.refresh(cx);
    const branch = this.status?.branch;
    return v_flex().size_full().min_h(0).bg(t.chrome).px(16).pt(14).gap(14).text_size(13).overflow_y_scrollbar()
      .child(h_flex().gap(8).items_center()
        .child(div().text_size(16).font_semibold().text_color(t.foreground).truncate().child(name))
        .when(Boolean(branch), (el) => el.child(div().flex_none().px(8).rounded(10).bg(t.raised).text_size(12).text_color(t.muted).child(branch))))
      .child(v_flex().gap(8)
        .child(div().text_size(11).font_bold().text_color(t.dim).child("RELEASE"))
        .child(this.body(t)));
  }
}
