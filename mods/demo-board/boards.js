// boards.tsv on the space's machine: one "<project>\t<board url>" line per project with a board turned on.
const BOARDS = '"$HOME/.config/demo-board/boards.tsv"';

export const READ_BOARDS = ["sh", "-c", `cat ${BOARDS}`];

/** The board link for `project`, or null when its board is off or the link is not a claude.ai one. */
export function boardUrl(tsv, project) {
  for (const line of (tsv ?? "").split("\n")) {
    if (!line.trim() || line.startsWith("#")) continue;
    const [name, url] = line.split("\t").map((part) => part.trim());
    if (name === project) return url?.startsWith("https://claude.ai/") ? url : null;
  }
  return null;
}

/** argv that removes `project`'s line from boards.tsv, passing the name as an argument, not in the script. */
export function turnOffCommand(project) {
  // ENVIRON, not -v: awk -v rewrites backslashes in the name.
  const filter = `{ k = $1; gsub(/^[ \\t]+|[ \\t]+$/, "", k) } k != ENVIRON["P"]`;
  const script = `P="$1" awk -F'\\t' '${filter}' ${BOARDS} > ${BOARDS}.tmp && mv ${BOARDS}.tmp ${BOARDS}`;
  return ["sh", "-c", script, "sh", project];
}
