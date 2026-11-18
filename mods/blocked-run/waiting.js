// A record's terminal id is used in a file path, and its commands are typed into a terminal.
const SAFE_ID = /^[A-Za-z0-9_-]{1,64}$/;
const CONTROL = /[\u0000-\u0008\u000b-\u001f\u007f]/;

function parseLine(line) {
  try {
    return [JSON.parse(line)];
  } catch {
    return [];
  }
}

const isRecord = (r) => Boolean(r) && SAFE_ID.test(r.terminal) && Array.isArray(r.queue);
const isCommand = (i) => typeof i?.command === "string" && Boolean(i.command.trim()) && !CONTROL.test(i.command);

/** Every waiting command, from `cat` of all records: [{ terminal, command, asked, index }]. */
export function parseWaiting(text) {
  return text.split("\n").flatMap(parseLine).filter(isRecord).flatMap((r) =>
    r.queue.filter(isCommand).map((i, index) => ({ terminal: r.terminal, command: i.command, asked: Boolean(i.asked), index })));
}

/** Only the commands from terminals in the space you're in: `addresses` are its terminals ("wsl/t2p"), `machine` its machine. */
export function forSpace(waiting, addresses, machine) {
  const shown = new Set(addresses);
  return waiting.filter((w) => shown.has(machine ? `${machine}/${w.terminal}` : w.terminal));
}

/** A terminal's queue in the record file's shape. */
export function queueOf(waiting, terminal) {
  return waiting.filter((w) => w.terminal === terminal).map(({ command, asked }) => ({ command, asked }));
}

/** What Run types into Claude: shell mode runs it as the user's own command. */
export function bangLine(command) {
  return `! ${command}`;
}

/** The terminal's queue without the item at `index`, to write back after Run or Dismiss. */
export function withoutItem(queue, index) {
  return queue.filter((_, i) => i !== index);
}
