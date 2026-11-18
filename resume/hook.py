import json
import os
import re
import subprocess
import sys
from pathlib import Path

# The terminal id becomes a file name and the session id is typed into a shell later.
SAFE_ID = re.compile(r"[A-Za-z0-9_-]{1,64}")
CONTROL = re.compile(r"[\x00-\x1f\x7f]")


def record_dir():
    return Path.home() / ".config" / "herdr-resume"


def record_path(terminal):
    return record_dir() / f"{terminal}.json"


def live_terminals():
    try:
        result = subprocess.run(["hc", "ls", "--json"], capture_output=True, text=True, timeout=5)
        listing = json.loads(result.stdout)
    except (OSError, subprocess.SubprocessError, ValueError):
        return None
    if result.returncode != 0 or not isinstance(listing, dict):
        return None
    return {t.get("address") for t in listing.get("terminals", []) if isinstance(t, dict)}


def prune(terminal):
    live = live_terminals()
    # A list without this terminal is wrong, so trusting it could delete every record.
    if live is None or terminal not in live:
        return
    for path in record_dir().glob("*.json"):
        if path.stem not in live:
            path.unlink(missing_ok=True)


def save(path, record):
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_suffix(".tmp")
    temp.write_text(json.dumps(record) + "\n")
    temp.replace(path)


def handle(event, terminal):
    session = event.get("session_id")
    if not isinstance(session, str) or not SAFE_ID.fullmatch(session):
        return
    path = record_path(terminal)
    kind = event.get("hook_event_name")
    if kind == "SessionStart":
        save(path, {"terminal": terminal, "session": session, "cwd": event.get("cwd", "")})
        prune(terminal)
    elif kind == "SessionEnd" and recorded_session(path) == session:
        path.unlink(missing_ok=True)


def recorded_session(path):
    try:
        record = json.loads(path.read_text())
    except (OSError, ValueError):
        return None
    return record.get("session") if isinstance(record, dict) else None


def resume_target(record):
    if not isinstance(record, dict):
        return None
    session, cwd = record.get("session"), record.get("cwd")
    if not isinstance(session, str) or not SAFE_ID.fullmatch(session):
        return None
    if not isinstance(cwd, str) or CONTROL.search(cwd):
        return None
    return session, cwd


def take(terminal):
    """Removes this terminal's record, so a resume that fails is never retried."""
    path = record_path(terminal)
    try:
        text = path.read_text()
    except OSError:
        return None
    path.unlink()
    try:
        return resume_target(json.loads(text))
    except ValueError:
        return None


def main():
    terminal = os.environ.get("HC_TERMINAL_ID", "")
    if not SAFE_ID.fullmatch(terminal):
        return
    if sys.argv[1:] == ["take"]:
        target = take(terminal)
        if target:
            print(*target, sep="\n")
        return
    try:
        event = json.load(sys.stdin)
    except ValueError:
        return
    if isinstance(event, dict):
        handle(event, terminal)


if __name__ == "__main__":
    main()
