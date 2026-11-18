import json
import os
import subprocess
import tempfile
import time
import unittest
from pathlib import Path

SCRIPT = Path(__file__).with_name("on-shell-start.sh")
SESSION = "0b6f2c1e-7d4a-4c1b-9e2f-5a8d3c7b1f00"
FAKE_HC = '#!/bin/sh\nprintf "%s|%s|%s\\n" "$1" "$2" "$3" >> "$HOME/hc.log"\n'


class ShellStartTest(unittest.TestCase):
    def setUp(self):
        self.home = Path(tempfile.mkdtemp())
        self.records = self.home / ".config" / "herdr-resume"
        self.records.mkdir(parents=True)
        self.project = self.home / "my app's folder"
        self.project.mkdir()
        bin_dir = self.home / "bin"
        bin_dir.mkdir()
        (bin_dir / "hc").write_text(FAKE_HC)
        (bin_dir / "hc").chmod(0o755)
        self.path = f"{bin_dir}:{os.environ['PATH']}"

    def save_record(self, **overrides):
        record = {"terminal": "t1y", "session": SESSION, "cwd": str(self.project), **overrides}
        (self.records / "t1y.json").write_text(json.dumps(record) + "\n")

    def start_shell(self, terminal="t1y", outer_level="0"):
        env = {"HOME": str(self.home), "PATH": self.path, "SHLVL": outer_level}
        if terminal is not None:
            env["HC_TERMINAL_ID"] = terminal
        subprocess.run(["bash", "--norc", "-c", f"source '{SCRIPT}'"], env=env, check=True)

    def claude_calls(self, wait=0.0):
        log = self.home / "hc.log"
        deadline = time.monotonic() + wait
        while not log.exists() and time.monotonic() < deadline:
            time.sleep(0.02)
        return log.read_text().splitlines() if log.exists() else []

    def test_first_shell_types_resume_command_into_its_terminal(self):
        self.save_record()

        self.start_shell()

        [call] = self.claude_calls(wait=5)
        verb, target, command = call.split("|", 2)
        self.assertEqual((verb, target, command.endswith(f" && claude --resume {SESSION}")), ("send", "t1y", True))

    def test_typed_command_runs_in_the_saved_folder(self):
        self.save_record()
        self.start_shell()
        command = self.claude_calls(wait=5)[0].split("|", 2)[2]

        result = subprocess.run(
            ["bash", "-c", command.replace("claude --resume", "echo $PWD #")],
            capture_output=True, text=True,
        )

        self.assertEqual(result.stdout.strip(), str(self.project))

    def test_resuming_removes_the_record(self):
        self.save_record()

        self.start_shell()

        self.assertEqual(list(self.records.iterdir()), [])

    def test_shell_without_record_starts_nothing(self):
        self.start_shell()

        self.assertEqual(self.claude_calls(), [])

    def test_nested_shell_leaves_record_alone(self):
        self.save_record()

        self.start_shell(outer_level="1")

        self.assertEqual((self.claude_calls(), len(list(self.records.iterdir()))), ([], 1))

    def test_shell_outside_herdr_starts_nothing(self):
        self.save_record()

        self.start_shell(terminal=None)

        self.assertEqual(self.claude_calls(), [])

    def test_record_with_bad_session_is_dropped_without_resuming(self):
        self.save_record(session="x; rm -rf ~")

        self.start_shell()

        self.assertEqual((self.claude_calls(), list(self.records.iterdir())), ([], []))

    def test_record_with_newline_in_folder_starts_nothing(self):
        self.save_record(cwd=f"{self.project}\n/tmp")

        self.start_shell()

        self.assertEqual(self.claude_calls(), [])

    def test_missing_folder_starts_nothing(self):
        self.save_record(cwd=str(self.home / "gone"))

        self.start_shell()

        self.assertEqual(self.claude_calls(), [])

    def test_broken_record_starts_nothing(self):
        (self.records / "t1y.json").write_text("not json")

        self.start_shell()

        self.assertEqual(self.claude_calls(), [])


if __name__ == "__main__":
    unittest.main()
