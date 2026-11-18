import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from asked import asked_commands  # noqa: E402

PUSH = "git -C /home/me/game push origin --delete feat/knight"


class AskedCommandsTest(unittest.TestCase):
    def test_an_ask_in_each_form_gives_that_command(self):
        replies = {
            "on its own line": f"What you do now: run this one:\n\n! {PUSH}\n\nThen tell me.",
            "indented in a list": f"1. Run it:\n   ! {PUSH}",
            "inside a code block": f"Run:\n```\n! {PUSH}\n```",
        }
        for desc, reply in replies.items():
            with self.subTest(desc):
                self.assertEqual(asked_commands(reply), [PUSH])

    def test_two_asks_on_separate_lines_come_in_order(self):
        self.assertEqual(asked_commands("! git fetch\nthen\n! git pull"), ["git fetch", "git pull"])

    def test_a_command_mentioned_inside_a_sentence_gives_nothing(self):
        replies = {
            "backticked in a sentence": "Real asks like `! gh pr merge 50` still show up.",
            "two backticked on one line": "Run `! git fetch` and then `! git pull`.",
            "a placeholder": "Claude ends a reply with `! command` for you to run.",
        }
        for desc, reply in replies.items():
            with self.subTest(desc):
                self.assertEqual(asked_commands(reply), [])

    def test_text_that_is_not_an_ask_gives_nothing(self):
        replies = {
            "no bang line": "All done. Nothing to do.",
            "a bang with no space": "!important",
            "a bang mid-sentence": "That worked! great",
            "a bang with nothing after it": "! ",
        }
        for desc, reply in replies.items():
            with self.subTest(desc):
                self.assertEqual(asked_commands(reply), [])

    def test_a_command_split_with_a_backslash_comes_back_whole(self):
        self.assertEqual(asked_commands("! docker compose up \\\n  --build web"), ["docker compose up \\\n  --build web"])

    def test_a_script_in_a_code_block_gives_nothing(self):
        self.assertEqual(asked_commands("```bash\nset -e\n! grep -q foo file && exit 1\n```"), [])


if __name__ == "__main__":
    unittest.main()
