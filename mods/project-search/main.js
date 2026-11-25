import { View, div, svg } from "gpui-kit";
import { v_flex, h_flex, InputState, Input } from "gpui-base";
import { checking, closeOverlay, exec, props, spaces, theme } from "herdr";
import { matchProjects, parseRepos } from "./projects.js";
import { openAgent, openTerminal } from "./open.js";

const FIND = ["-c", "find ~/projects -maxdepth 4 -name .git -type d -prune 2>/dev/null"];
const MAX_ROWS = 12;

/** Type to find a repo; Enter opens a terminal there, Ctrl+Enter starts Claude there. */
export default class ProjectSearch extends View {
  init(_props, cx) {
    this.repos = null;
    this.at = 0;
    this.handle = cx.focus_handle();
    this.input = InputState.new({ placeholder: "Type a project name…" });
    this.input.on("change", (_e, cx) => { this.at = 0; cx.notify(); });
    this.input.on("submit", (e) => this.go(this.matches()[this.at], Boolean(e?.secondary)));
    this.input.focus();
    if (checking()) return;
    cx.spawn(async (cx) => {
      const r = await exec("sh", FIND, { on: "wsl" }).catch(() => null);
      this.repos = r ? parseRepos(r.stdout) : [];
      this.failed = !r;
      cx.notify();
    });
  }

  matches() {
    return matchProjects(this.repos ?? [], this.input.value()).slice(0, MAX_ROWS);
  }

  go(project, agent) {
    if (!project) return;
    closeOverlay(props().overlay);
    if (agent) openAgent(project, spaces());
    else openTerminal(project, spaces());
  }

  row(p, i, t) {
    const on = i === this.at;
    return h_flex().id(`repo-${p.path}`).h(44).px(10).gap(10).items_center().rounded(6).cursor_pointer()
      .when(on, (el) => el.bg(t.selected)).hover((s) => s.bg(t.hover)).on_click(() => this.go(p, false))
      .child(div().flex_1().min_w(0).child(div().text_color(t.foreground).truncate().child(p.name))
        .child(div().text_size(11).text_color(t.dim).truncate().child(p.path)))
      .when(on, (el) => el.child(div().text_size(11).text_color(t.dim).child("Enter terminal · Ctrl+Enter Claude")));
  }

  status(t, list) {
    if (this.repos === null) return div().px(10).py(8).text_color(t.dim).child("Finding projects in ~/projects…");
    if (this.failed) return div().px(10).py(8).text_color(t.blocked).child("Could not read ~/projects on wsl.");
    if (!list.length) return div().px(10).py(8).text_color(t.dim).child("No project matches.");
    return null;
  }

  render() {
    const t = theme(), list = this.matches();
    this.at = Math.min(this.at, Math.max(list.length - 1, 0));
    return v_flex().id("project-search").track_focus(this.handle).size_full().min_h(0).p(14).gap(10).bg(t.popover).text_size(13)
      .on_key_down((e, cx) => {
        if (e.key === "escape") return closeOverlay(props().overlay);
        if (e.key === "down") this.at = Math.max(0, Math.min(this.at + 1, list.length - 1));
        else if (e.key === "up") this.at = Math.max(this.at - 1, 0);
        else return;
        cx.stop_propagation();
        cx.notify();
      })
      .child(h_flex().h(36).flex_none().px(10).gap(8).items_center().rounded(8).border_1().border_color(t.accent).bg(t.background)
        .child(svg("mods/workspace-chrome/search.svg").size(15).text_color(t.dim))
        .child(Input.new(this.input).flex_1().h_full().text_color(t.foreground)))
      .child(v_flex().id("repo-list").flex_1().min_h(0).gap(2).overflow_y_scrollbar().children([this.status(t, list)].filter(Boolean)).children(list.map((p, i) => this.row(p, i, t))));
  }
}
