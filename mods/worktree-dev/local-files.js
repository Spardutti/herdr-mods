import { exec } from "herdr";

// Ignored by git, so a new checkout lacks them; without them Claude has no skills or hooks there.
// Copies only missing files, and skips Claude's own worktree checkouts.
const COPY = `cd "$1" || exit 1
find .claude CLAUDE.md -path .claude/worktrees -prune -o ! -type d -print 2>/dev/null | while IFS= read -r f; do
  [ -e "$2/$f" ] || { mkdir -p "$2/$(dirname "$f")" && cp -P "$f" "$2/$f"; } || exit 1
done`;

export async function copyLocalFiles(from, to, on) {
  try {
    const r = await exec("sh", ["-c", COPY, "sh", from, to], { on });
    return r.code === 0 ? "" : (r.stderr || "Could not copy .claude into the worktree.").trim();
  } catch (error) {
    return String(error);
  }
}
