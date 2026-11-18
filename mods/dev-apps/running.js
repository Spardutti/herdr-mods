export const START_MS = 90_000;
export const STOP_MS = 90_000;

export function listeningPorts(ss) {
  const ports = ss
    .split("\n")
    .map((line) => line.trim().split(/\s+/)[3])
    .map((local) => Number(local?.slice(local.lastIndexOf(":") + 1)))
    .filter((port) => port > 0);
  return [...new Set(ports)];
}

// True while a press is within its window: a start or stop that outlived it no longer blocks the buttons.
export const isBusy = ({ startedAt, stoppingAt }, now) =>
  (startedAt !== undefined && now - startedAt <= START_MS) || (stoppingAt !== undefined && now - stoppingAt <= STOP_MS);

export function statusOf(isListening, { startedAt, stoppingAt }, now) {
  if (isListening) return stoppingAt !== undefined && now - stoppingAt <= STOP_MS ? "stopping" : "running";
  if (startedAt === undefined) return "stopped";
  return now - startedAt <= START_MS ? "starting" : "failed";
}
