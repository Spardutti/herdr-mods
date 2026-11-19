import { View, div } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { checking, exec, focused, panes, spaces, theme } from "herdr";
import { READ_BOARDS, boardUrl, turnOffCommand } from "./boards.js";
import { projectName } from "./project.js";

// The focused space's folder and machine, as Herdr's changes mod finds them.
function location() {
  const space = spaces().find((s) => s.active), f = focused();
  const pane = f?.pane ? panes().find((p) => p.pane === f.pane) : null;
  return { cwd: pane?.cwd || f?.cwd || space?.folder, on: space?.machine ?? null };
}

const run = async (argv, cwd, on) => {
  const r = await exec(argv[0], argv.slice(1), { cwd, on }).catch(() => null);
  return r?.code === 0 ? r.stdout : undefined;
};

export default class DemoBoard extends View {
  init(_props, cx) {
    this.board = undefined;
    if (checking()) return;
    this.load(cx);
  }

  load(cx) {
    const { cwd, on } = location(), key = JSON.stringify([cwd, on]);
    this.key = key;
    this.board = undefined;
    if (!cwd) return;
    cx.spawn(async (cx) => {
      const commonDir = await run(["git", "rev-parse", "--path-format=absolute", "--git-common-dir"], cwd, on);
      const name = projectName(commonDir, cwd);
      const url = boardUrl(await run(READ_BOARDS, cwd, on), name);
      if (key === this.key) this.board = { name, url };
      cx.notify();
    });
  }

  turnOff(cx) {
    const { cwd, on } = location(), name = this.board?.name;
    if (!name) return;
    cx.spawn(async (cx) => {
      await run(turnOffCommand(name), cwd, on);
      this.load(cx);
    });
  }

  button({ id, label, onClick, colors }) {
    return h_flex().id(id).flex_none().h(28).px(14).items_center().rounded(7).cursor_pointer().text_size(12).font_semibold()
      .bg(colors.bg).text_color(colors.fg).border_1().border_color(colors.border)
      .hover((s) => s.opacity(0.88)).on_click(onClick).child(label);
  }

  body(t) {
    const b = this.board;
    if (b === undefined) return div().text_size(12.5).text_color(t.dim).child("Checking…");
    if (!b.url) return div().text_size(12.5).text_color(t.dim).child(`Off for ${b.name}. To turn it on, ask Claude: "turn on the demo board".`);
    return h_flex().gap(8).items_center()
      .child(this.button({ id: "open", label: "Open board ↗", onClick: () => exec("explorer.exe", [b.url]).catch(() => null),
        colors: { bg: t.solid, fg: t.solid_foreground, border: t.solid } }))
      .child(div().flex_1())
      .child(this.button({ id: "off", label: "Turn off", onClick: (_e, cx) => this.turnOff(cx),
        colors: { bg: t.raised, fg: t.foreground, border: t.input } }));
  }

  render(cx) {
    const t = theme(), { cwd, on } = location();
    if (JSON.stringify([cwd, on]) !== this.key && !checking()) this.load(cx);
    return v_flex().size_full().min_h(0).bg(t.chrome).px(16).pt(10).gap(8).text_size(13)
      .child(div().text_size(11).font_bold().text_color(t.dim).child("DEMO"))
      .child(this.body(t));
  }
}
