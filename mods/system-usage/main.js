import { View, div } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { checking, exec, theme } from "herdr";
import { cpuPercent, cpuTimes, gib, memory } from "./usage.js";

const MACHINE = "wsl";

function levelColor(percent, t) {
  if (percent >= 85) return t.blocked;
  if (percent >= 60) return t.ansi3;
  return t.ansi2;
}

export default class SystemUsage extends View {
  init(_props, cx) {
    this.cpu = null;
    this.mem = null;
    this.error = null;
    if (checking()) return;
    this.read(cx);
    cx.timer.every(2000, (cx) => this.read(cx));
  }

  read(cx) {
    if (this.reading) return;
    this.reading = true;
    cx.spawn(async (cx) => {
      const r = await exec("cat", ["/proc/stat", "/proc/meminfo"], { on: MACHINE, timeout: 5000 }).catch(() => null);
      this.reading = false;
      if (r?.code !== 0) { this.error = `Could not read ${MACHINE}.`; cx.notify(); return; }
      const times = cpuTimes(r.stdout);
      if (this.times && times) this.cpu = cpuPercent(this.times, times);
      this.times = times;
      this.mem = memory(r.stdout);
      this.error = null;
      cx.notify();
    });
  }

  meter(label, percent, detail) {
    const t = theme(), color = levelColor(percent, t);
    return v_flex().gap(6)
      .child(h_flex().items_end().gap(8)
        .child(div().flex_1().text_size(11).font_bold().text_color(t.dim).child(label))
        .child(div().text_size(12).text_color(t.muted).child(detail))
        .child(div().text_size(18).font_bold().text_color(color).child(`${percent}%`)))
      .child(div().h(8).w_full().rounded(4).bg(t.raised)
        .child(div().h_full().w(`${percent}%`).rounded(4).bg(color)));
  }

  body(t) {
    if (this.error) return div().text_color(t.dim).child(this.error);
    if (!this.mem) return div().text_color(t.dim).child("Reading…");
    const { used, total, swapUsed, swapTotal } = this.mem;
    const memPct = total ? Math.round((used / total) * 100) : 0;
    const swapPct = swapTotal ? Math.round((swapUsed / swapTotal) * 100) : 0;
    return v_flex().gap(14)
      .child(this.meter("CPU", this.cpu ?? 0, ""))
      .child(this.meter("RAM", memPct, `${gib(used)} / ${gib(total)} GB`))
      .when(swapTotal > 0, (el) => el.child(this.meter("SWAP", swapPct, `${gib(swapUsed)} / ${gib(swapTotal)} GB`)));
  }

  render() {
    const t = theme();
    return v_flex().size_full().bg(t.chrome).px(16).py(14).gap(14).text_size(13)
      .child(div().text_size(16).font_semibold().text_color(t.foreground).child("WSL usage"))
      .child(this.body(t));
  }
}
