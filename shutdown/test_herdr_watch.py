import os
import subprocess
import tempfile
import unittest
from pathlib import Path

SCRIPT = Path(__file__).with_name("herdr-watch.sh")
FAKE_TASKLIST = """#!/bin/sh
echo call >> "$HOME/calls"
answer=$(head -n 1 "$HOME/answers")
sed -i 1d "$HOME/answers"
case "$answer" in
  up) printf 'herdr-app.exe    26892 Console    6    260,024 K\\r\\n' ;;
  fail) exit 1 ;;
  *) printf 'INFO: No tasks are running which match the specified criteria.\\r\\n' ;;
esac
"""
FAKE_WSL = '#!/bin/sh\necho "wsl $*" >> "$HOME/windows.log"\n'
FAKE_TASKKILL = '#!/bin/sh\necho "taskkill $*" >> "$HOME/windows.log"\n'
SHUTDOWN = "taskkill /F /IM herdr-core.exe\nwsl --shutdown\n"


class HerdrWatchTest(unittest.TestCase):
    def setUp(self):
        self.home = Path(tempfile.mkdtemp())
        bin_dir = self.home / "bin"
        bin_dir.mkdir()
        for name, body in (("tasklist.exe", FAKE_TASKLIST), ("wsl.exe", FAKE_WSL), ("taskkill.exe", FAKE_TASKKILL)):
            (bin_dir / name).write_text(body)
            (bin_dir / name).chmod(0o755)
        self.env = {"HOME": str(self.home), "PATH": f"{bin_dir}:{os.environ['PATH']}",
                    "HERDR_WATCH_INTERVAL": "0"}

    def watch(self, *answers):
        (self.home / "answers").write_text("".join(f"{a}\n" for a in answers))
        subprocess.run([str(SCRIPT)], env=self.env, timeout=5, check=True)
        calls = len((self.home / "calls").read_text().splitlines())
        return calls, (self.home / "windows.log").read_text()

    def test_app_closed_for_two_checks_shuts_wsl_down(self):
        self.assertEqual(self.watch("down", "down"), (2, SHUTDOWN))

    def test_app_seen_again_restarts_the_count(self):
        self.assertEqual(self.watch("down", "up", "down", "down"), (4, SHUTDOWN))

    def test_failed_check_does_not_count_as_closed(self):
        self.assertEqual(self.watch("down", "fail", "fail", "down"), (4, SHUTDOWN))


if __name__ == "__main__":
    unittest.main()
