import json
import os
import re
import sys
from pathlib import Path

# -I drops this folder from the import path; asked.py lives beside this file.
sys.path.insert(0, str(Path(__file__).resolve().parent))
from asked import asked_commands  # noqa: E402

# The terminal id becomes a file name.
SAFE_ID = re.compile(r"[A-Za-z0-9_-]{1,64}")


def queue_path(terminal):
    return Path.home() / ".config" / "herdr-blocked" / f"{terminal}.json"


def load(path):
    try:
        queue = json.loads(path.read_text()).get("queue")
    except (OSError, ValueError, AttributeError):
        return []
    return queue if isinstance(queue, list) else []


def save(path, terminal, queue):
    if not queue:
        path.unlink(missing_ok=True)
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_suffix(".tmp")
    temp.write_text(json.dumps({"terminal": terminal, "queue": queue}) + "\n")
    temp.replace(path)


def after_block(queue, command):
    """The queue with a command auto mode blocked added at the end."""
    return [*queue, {"command": command, "asked": False}]


def after_reply(queue, commands):
    """The queue after Claude replied: its old unrun asks dropped, blocked ones kept, the new asks added."""
    kept = [item for item in queue if not item.get("asked")]
    return kept + [{"command": command, "asked": True} for command in commands]


def blocked_command(event):
    if event.get("tool_name") != "Bash":
        return None
    command = (event.get("tool_input") or {}).get("command")
    return command if isinstance(command, str) and command.strip() else None


def handle(event, terminal):
    """Updates ~/.config/herdr-blocked/<terminal>.json on PermissionDenied (Bash only) and Stop."""
    path, kind = queue_path(terminal), event.get("hook_event_name")
    if kind == "PermissionDenied":
        command = blocked_command(event)
        if command:
            save(path, terminal, after_block(load(path), command))
    elif kind == "Stop":
        reply = event.get("last_assistant_message")
        save(path, terminal, after_reply(load(path), asked_commands(reply if isinstance(reply, str) else "")))


def main():
    terminal = os.environ.get("HC_TERMINAL_ID", "")
    if not SAFE_ID.fullmatch(terminal):
        return
    try:
        event = json.load(sys.stdin)
    except ValueError:
        return
    if isinstance(event, dict):
        handle(event, terminal)


if __name__ == "__main__":
    main()
