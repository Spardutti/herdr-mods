import { exec } from "herdr";

// Ignored by git, so a new checkout lacks them; without them Claude has no skills or hooks there.
const COPY = 'for f in .claude CLAUDE.md; do if [ -e "$1/$f" ] && [ ! -e "$2/$f" ]; then cp -R "$1/$f" "$2/" || exit 1; fi; done';

export async function copyLocalFiles(from, to, on) {
  const r = await exec("sh", ["-c", COPY, "sh", from, to], { on });
  return r.code === 0 ? "" : (r.stderr || "Could not copy .claude into the worktree.").trim();
}
