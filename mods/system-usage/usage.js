export function cpuTimes(stat) {
  const line = stat.split("\n").find((l) => l.startsWith("cpu "));
  if (!line) return null;
  const [user, nice, system, idle, iowait = 0, irq = 0, softirq = 0, steal = 0] = line.trim().split(/\s+/).slice(1).map(Number);
  return { busy: user + nice + system + irq + softirq + steal, total: user + nice + system + idle + iowait + irq + softirq + steal };
}

export function cpuPercent(before, after) {
  const total = after.total - before.total;
  if (total <= 0) return 0;
  return Math.round(((after.busy - before.busy) / total) * 100);
}

export function memory(meminfo) {
  const kb = (key) => Number(meminfo.match(new RegExp(`^${key}:\\s+(\\d+)`, "m"))?.[1] ?? 0);
  const total = kb("MemTotal"), available = kb("MemAvailable");
  const swapTotal = kb("SwapTotal"), swapFree = kb("SwapFree");
  return { used: total - available, total, swapUsed: swapTotal - swapFree, swapTotal };
}

export const gib = (kb) => (kb / 1048576).toFixed(1);
