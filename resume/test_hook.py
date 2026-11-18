import importlib.util
import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

HOOK = Path(__file__).with_name("hook.py")
SESSION = "0b6f2c1e-7d4a-4c1b-9e2f-5a8d3c7b1f00"
FAKE_HC = '#!/bin/sh\ncat "$HOME/hc-ls.json" 2>/dev/null || exit 1\n'


def fake_hc_path(home):
    bin_dir = Path(home) / "bin"
    bin_dir.mkdir(exist_ok=True)
    (bin_dir / "hc").write_text(FAKE_HC)
    (bin_dir / "hc").chmod(0o755)
    return f"{bin_dir}:{os.environ['PATH']}"


def run_hook(home, event, terminal="t2p"):
    env = {"HOME": str(home), "PATH": fake_hc_path(home)}
    if terminal is not None:
        env["HC_TERMINAL_ID"] = terminal
    return subprocess.run(
        [sys.executable, "-I", str(HOOK)],
        input=json.dumps(event), env=env, capture_output=True, text=True,
    )


def start_event(session=SESSION, cwd="/home/me/app"):
    return {"hook_event_name": "SessionStart", "session_id": session, "cwd": cwd}


def end_event(session=SESSION):
    return {"hook_event_name": "SessionEnd", "session_id": session, "reason": "prompt_input_exit"}


class HookTest(unittest.TestCase):
    def setUp(self):
        self.home = Path(tempfile.mkdtemp())
        self.records = self.home / ".config" / "herdr-resume"

    def test_session_start_writes_record_for_terminal(self):
        run_hook(self.home, start_event())

        text = (self.records / "t2p.json").read_text()
        record = {"terminal": "t2p", "session": SESSION, "cwd": "/home/me/app"}
        self.assertEqual(text, json.dumps(record) + "\n")

    def test_session_start_prints_nothing(self):
        result = run_hook(self.home, start_event())

        self.assertEqual((result.returncode, result.stdout, result.stderr), (0, "", ""))

    def test_session_end_deletes_record(self):
        run_hook(self.home, start_event())

        run_hook(self.home, end_event())

        self.assertEqual(list(self.records.iterdir()), [])

    def test_old_session_ending_after_clear_keeps_new_record(self):
        new = "1c7e3d2f-8e5b-4d2c-af30-6b9e4d8c2a11"
        run_hook(self.home, start_event(session=new))

        run_hook(self.home, end_event())

        record = json.loads((self.records / "t2p.json").read_text())
        self.assertEqual(record["session"], new)

    def test_session_end_when_record_vanishes_before_delete_succeeds(self):
        spec = importlib.util.spec_from_file_location("resume_hook", HOOK)
        hook = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(hook)
        path = self.records / "t2p.json"

        def taken_meanwhile(record):
            record.unlink()
            return SESSION

        with mock.patch.dict(os.environ, {"HOME": str(self.home)}):
            run_hook(self.home, start_event())
            with mock.patch.object(hook, "recorded_session", taken_meanwhile):
                hook.handle(end_event(), "t2p")

        self.assertFalse(path.exists())

    def test_session_end_without_record_succeeds(self):
        result = run_hook(self.home, end_event())

        self.assertEqual(result.returncode, 0)

    def test_outside_herdr_terminal_writes_nothing(self):
        run_hook(self.home, start_event(), terminal=None)

        self.assertFalse(self.records.exists())

    def test_terminal_id_with_path_characters_is_refused(self):
        run_hook(self.home, start_event(), terminal="../../evil")

        self.assertFalse(self.records.exists())

    def test_session_id_with_shell_characters_is_refused(self):
        run_hook(self.home, start_event(session="x; rm -rf ~"))

        self.assertFalse(self.records.exists())

    def test_session_id_that_is_not_text_is_refused(self):
        run_hook(self.home, start_event(session=12345))

        self.assertFalse(self.records.exists())

    def test_event_without_cwd_saves_empty_folder(self):
        event = start_event()
        del event["cwd"]

        run_hook(self.home, event)

        record = json.loads((self.records / "t2p.json").read_text())
        self.assertEqual(record["cwd"], "")

    def save_old_record(self, terminal):
        self.records.mkdir(parents=True, exist_ok=True)
        (self.records / f"{terminal}.json").write_text("{}\n")

    def list_terminals(self, *addresses):
        listing = {"terminals": [{"address": a, "state": "live"} for a in addresses]}
        (self.home / "hc-ls.json").write_text(json.dumps(listing))

    def record_names(self):
        return sorted(p.name for p in self.records.iterdir())

    def test_session_start_deletes_records_of_closed_terminals(self):
        self.save_old_record("t9")
        self.list_terminals("t2p", "t7")

        run_hook(self.home, start_event())

        self.assertEqual(self.record_names(), ["t2p.json"])

    def test_session_start_keeps_records_of_open_terminals(self):
        self.save_old_record("t7")
        self.list_terminals("t2p", "t7")

        run_hook(self.home, start_event())

        self.assertEqual(self.record_names(), ["t2p.json", "t7.json"])

    def test_failing_terminal_list_deletes_nothing(self):
        self.save_old_record("t9")

        run_hook(self.home, start_event())

        self.assertEqual(self.record_names(), ["t2p.json", "t9.json"])

    def test_terminal_list_missing_this_terminal_deletes_nothing(self):
        self.save_old_record("t9")
        self.list_terminals("t7")

        run_hook(self.home, start_event())

        self.assertEqual(self.record_names(), ["t2p.json", "t9.json"])

    def test_cleanup_leaves_other_files_alone(self):
        self.records.mkdir(parents=True)
        (self.records / "notes.txt").write_text("keep")
        self.list_terminals("t2p")

        run_hook(self.home, start_event())

        self.assertEqual(self.record_names(), ["notes.txt", "t2p.json"])

    def test_bad_json_input_exits_cleanly(self):
        env = {"HOME": str(self.home), "PATH": os.environ["PATH"], "HC_TERMINAL_ID": "t2p"}
        result = subprocess.run(
            [sys.executable, "-I", str(HOOK)], input="not json",
            env=env, capture_output=True, text=True,
        )

        self.assertEqual((result.returncode, self.records.exists()), (0, False))


if __name__ == "__main__":
    unittest.main()
