import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

HOOK = Path(__file__).with_name("hook.py")


def denied(command, tool="Bash"):
    return {"hook_event_name": "PermissionDenied", "tool_name": tool, "tool_input": {"command": command}}


def stopped(reply):
    return {"hook_event_name": "Stop", "last_assistant_message": reply}


class HookTest(unittest.TestCase):
    def setUp(self):
        self.home = Path(tempfile.mkdtemp())
        self.file = self.home / ".config" / "herdr-blocked" / "t2p.json"

    def run_hook(self, event, terminal="t2p"):
        env = {"HOME": str(self.home), "PATH": os.environ["PATH"]}
        if terminal is not None:
            env["HC_TERMINAL_ID"] = terminal
        return subprocess.run([sys.executable, "-I", str(HOOK)], input=json.dumps(event), env=env, capture_output=True, text=True)

    def queue(self):
        record = json.loads(self.file.read_text())
        self.assertEqual(record["terminal"], "t2p")
        return record["queue"]

    def test_a_blocked_bash_command_is_saved(self):
        self.run_hook(denied("gh pr merge 50 --squash"))

        self.assertEqual(self.queue(), [{"command": "gh pr merge 50 --squash", "asked": False, "this_turn": True}])

    def test_a_blocked_command_joins_the_end_of_the_queue(self):
        self.run_hook(denied("git push"))

        self.run_hook(denied("gh pr merge 50"))

        self.assertEqual([i["command"] for i in self.queue()], ["git push", "gh pr merge 50"])

    def test_a_blocked_edit_is_not_saved(self):
        self.run_hook(denied("x", tool="Edit"))

        self.assertFalse(self.file.exists())

    def test_asks_in_a_reply_are_saved(self):
        self.run_hook(stopped("Run this:\n! git push origin main"))

        self.assertEqual(self.queue(), [{"command": "git push origin main", "asked": True}])

    def test_a_new_reply_drops_the_asks_nobody_ran(self):
        self.run_hook(stopped("! git fetch"))

        self.run_hook(stopped("! git pull"))

        self.assertEqual(self.queue(), [{"command": "git pull", "asked": True}])

    def test_a_new_reply_keeps_blocked_commands(self):
        self.run_hook(denied("gh pr merge 50"))

        self.run_hook(stopped("Done."))

        self.assertEqual(self.queue(), [{"command": "gh pr merge 50", "asked": False}])

    def test_an_ask_replaces_commands_blocked_in_the_same_turn(self):
        self.run_hook(denied("gh workflow run build.yml && sleep 8"))

        self.run_hook(stopped("! gh workflow run build.yml"))

        self.assertEqual(self.queue(), [{"command": "gh workflow run build.yml", "asked": True}])

    def test_an_ask_keeps_commands_blocked_in_an_earlier_turn(self):
        self.run_hook(denied("git push"))
        self.run_hook(stopped("Done."))

        self.run_hook(stopped("! gh pr merge 50"))

        self.assertEqual(self.queue(), [{"command": "git push", "asked": False}, {"command": "gh pr merge 50", "asked": True}])

    def test_a_reply_with_nothing_waiting_deletes_the_file(self):
        self.run_hook(stopped("! git fetch"))

        self.run_hook(stopped("Done."))

        self.assertFalse(self.file.exists())

    def test_the_hook_prints_nothing(self):
        result = self.run_hook(denied("git push"))

        self.assertEqual((result.returncode, result.stdout, result.stderr), (0, "", ""))

    def test_outside_herdr_nothing_is_saved(self):
        self.run_hook(denied("git push"), terminal=None)

        self.assertFalse(self.file.parent.exists())

    def test_a_terminal_id_with_a_slash_is_refused(self):
        self.run_hook(denied("git push"), terminal="../x")

        self.assertFalse(self.file.parent.exists())

    def test_a_bad_entry_in_the_file_does_not_break_the_next_reply(self):
        self.file.parent.mkdir(parents=True)
        self.file.write_text(json.dumps({"terminal": "t2p", "queue": ["git push"]}))

        result = self.run_hook(stopped("! ls"))

        self.assertEqual((result.returncode, self.queue()), (0, [{"command": "ls", "asked": True}]))

    def test_commands_blocked_at_the_same_moment_are_all_kept(self):
        env = {"HOME": str(self.home), "PATH": os.environ["PATH"], "HC_TERMINAL_ID": "t2p"}
        hooks = [subprocess.Popen([sys.executable, "-I", str(HOOK)], stdin=subprocess.PIPE, env=env, text=True,
                                  stderr=subprocess.DEVNULL) for _ in range(12)]
        for n, hook in enumerate(hooks):
            hook.stdin.write(json.dumps(denied(f"echo {n}")))
            hook.stdin.close()
        for hook in hooks:
            hook.wait()

        self.assertEqual(sorted(i["command"] for i in self.queue()), sorted(f"echo {n}" for n in range(12)))


if __name__ == "__main__":
    unittest.main()
