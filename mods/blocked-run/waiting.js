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

/** What Run types into Claude: shell mode runs it as the user's own command. */
export function bangLine(command) {
  return `! ${command}`;
}

// Run on the terminal's machine as `python3 -I -c DROP_SCRIPT <terminal> <command>`: removes the first
// entry with that command from the file as it is now, under the lock the hook takes too.
export const DROP_SCRIPT = `
import fcntl, json, os, sys, pathlib
terminal, command = sys.argv[1], sys.argv[2]
folder = pathlib.Path.home() / ".config" / "herdr-blocked"
folder.mkdir(parents=True, exist_ok=True)
path = folder / (terminal + ".json")
with open(folder / ".lock", "w") as lock:
    fcntl.flock(lock, fcntl.LOCK_EX)
    try:
        queue = json.loads(path.read_text()).get("queue") or []
    except (OSError, ValueError, AttributeError):
        sys.exit(0)
    hits = [i for i, item in enumerate(queue) if isinstance(item, dict) and item.get("command") == command]
    if hits:
        del queue[hits[0]]
    if queue:
        temp = folder / (path.name + "." + str(os.getpid()) + ".tmp")
        temp.write_text(json.dumps({"terminal": terminal, "queue": queue}) + "\\n")
        temp.replace(path)
    else:
        path.unlink(missing_ok=True)
`;

/** Types the command in with `send`, and only once that worked removes it with `drop`. */
export async function runThenDrop(send, drop, item) {
  const result = await send(item).catch(() => null);
  if (result?.code !== 0) return false;
  await drop(item);
  return true;
}

/** Tells whether a check of the file started after the last Run or Dismiss, so an older one can't bring a card back. */
export function newTracker() {
  let changes = 0;
  return { begin: () => changes, change: () => { changes += 1; }, isFresh: (seen) => seen === changes };
}

/** The commands without those a Run or Dismiss is still working on, so a check can't bring their card back. */
export function withoutPending(waiting, pending) {
  return waiting.filter((w) => !pending.some((p) => p.terminal === w.terminal && p.command === w.command));
}
