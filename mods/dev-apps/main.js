import { View, div } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { exec, focused, panes, readTextFile, spaces, theme } from "herdr";
import { isAnyDown, isAnyUp } from "./containers.js";
import { appUrl, loadProject, pollProject, startProject, stopProject } from "./probe.js";
import { isBusy, statusOf } from "./running.js";

// The focused space's folder and machine, as Herdr's changes mod finds them.
function location() {
  const space = spaces().find((s) => s.active), f = focused();
  const pane = f?.pane ? panes().find((p) => p.pane === f.pane) : null;
  return { cwd: pane?.cwd || f?.cwd || space?.folder, on: space?.machine ?? null };
}

const machineOf = (on) => ({
  sh: async (argv, cwd) => {
    const r = await exec(argv[0], argv.slice(1), { cwd, on }).catch(() => null);
    return r?.code === 0 ? r.stdout : undefined;
  },
  read: (path) => readTextFile(path, { on }).catch(() => null),
});

const tint = (color) => (/^#[0-9a-f]{6}$/i.test(color ?? "") ? `${color}1f` : null);
const WORDS = { running: "Running", starting: "Starting…", stopping: "Stopping…", stopped: "Stopped", failed: "Failed" };

export default class DevApps extends View {
  init(_props, cx) {
    this.project = undefined;
    this.check(cx);
    cx.timer.every(3000, (cx) => this.check(cx));
  }

  // Loads the project on a new space, then keeps polling it.
  check(cx) {
    const { cwd, on } = location(), key = JSON.stringify([cwd, on]);
    if (key !== this.key) { this.key = key; this.project = undefined; this.busy = false; }
    if (!cwd || this.busy) return;
    this.busy = true;
    cx.spawn(async (cx) => {
      const { sh, read } = machineOf(on);
      const loaded = this.project === undefined ? await loadProject(sh, read, cwd) : this.project;
      const next = loaded && (await pollProject(sh, loaded, Date.now()));
      if (key === this.key) this.project = next;
      this.busy = false;
      cx.notify();
    });
  }

  act(cx, action) {
    const { on } = location(), key = this.key, project = this.project;
    cx.spawn(async (cx) => {
      const next = await action(machineOf(on).sh, project, Date.now());
      if (key === this.key) this.project = next;
      cx.notify();
    });
  }

  button(id, label, primary, t, onClick) {
    return h_flex().id(id).flex_none().h(28).px(14).items_center().rounded(7).cursor_pointer().text_size(12).font_semibold()
      .bg(primary ? t.solid : t.raised).text_color(primary ? t.solid_foreground : t.foreground)
      .border_1().border_color(primary ? t.solid : t.input).hover((s) => s.opacity(0.88)).on_click(onClick).child(label);
  }

  app(app, p, t, now) {
    const status = statusOf(p.listening.includes(app.port), p, now), up = status === "running";
    const color = up ? t.ansi2 : status === "failed" ? t.blocked : t.dim;
    const url = appUrl(app);
    return v_flex().id(`app-${app.service}`).gap(8).p(12).rounded(10).bg(up && tint(color) ? tint(color) : t.raised)
      .child(h_flex().gap(8).items_center()
        .child(div().size(8).flex_none().rounded(4).when(up, (el) => el.bg(color)).when(!up, (el) => el.border_1().border_color(color)))
        .child(div().flex_1().font_semibold().text_color(t.foreground).child(app.service))
        .child(div().text_size(12).font_semibold().text_color(color).child(WORDS[status])))
      .when(Boolean(url), (el) => el.child(div().id(`link-${app.service}`).text_size(14).cursor_pointer()
        .text_color(up ? t.accent : t.dim).hover((s) => s.opacity(0.8))
        .on_click(() => exec("explorer.exe", [url]).catch(() => null)).child(`${url.replace("http://", "")} ↗`)));
  }

  containers(services, t) {
    const color = (s) => (["running"].includes(s.state) ? t.ansi2 : s.state === "crashed" ? t.blocked : t.dim);
    return h_flex().flex_wrap().gap(12).px(4).text_size(12).text_color(t.muted).children(services.map((s) =>
      h_flex().id(`svc-${s.name}`).gap(6).items_center()
        .child(div().size(6).rounded(3).bg(color(s)))
        .child(s.state === "running" ? s.name : `${s.name} ${s.state}${s.exitCode ? ` (${s.exitCode})` : ""}`)));
  }

  controls(p, t, now) {
    if (!p.launcher) return null;
    if (isBusy(p, now)) return null;
    const anyListening = p.apps.some((a) => p.listening.includes(a.port));
    const canStart = p.apps.some((a) => !p.listening.includes(a.port)) || isAnyDown(p.services);
    const canStop = anyListening || isAnyUp(p.services);
    return h_flex().gap(8).justify_end()
      .when(canStart, (el) => el.child(this.button("start", "Start", true, t, (_e, cx) => this.act(cx, startProject))))
      .when(canStop, (el) => el.child(this.button("stop", "Stop", false, t, (_e, cx) => this.act(cx, stopProject))));
  }

  body(t) {
    const p = this.project, now = Date.now();
    if (p === undefined) return div().text_size(12.5).text_color(t.dim).child("Checking…");
    if (p === null) return div().text_size(12.5).text_color(t.dim).child("No browser apps for this project in dev-ports.");
    const controls = this.controls(p, t, now);
    return v_flex().gap(10)
      .children(p.apps.map((a) => this.app(a, p, t, now)))
      .when(Boolean(p.services?.length), (el) => el.child(this.containers(p.services, t)))
      .when(Boolean(p.failure), (el) => el.child(div().text_size(12).text_color(t.blocked).child(p.failure)))
      .when(Boolean(controls), (el) => el.child(controls));
  }

  render(cx) {
    const t = theme(), { cwd, on } = location();
    if (JSON.stringify([cwd, on]) !== this.key) this.check(cx);
    return v_flex().size_full().min_h(0).bg(t.chrome).px(16).pt(10).gap(8).text_size(13).overflow_y_scrollbar()
      .child(div().text_size(11).font_bold().text_color(t.dim).child("APPS"))
      .child(this.body(t));
  }
}
