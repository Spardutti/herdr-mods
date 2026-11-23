import { ID_PATTERN, isTodo, slug } from "./claude/todo.js";

const ROOT = '"$HOME/.config/todos"';

/** Prints "L\t<list>" per list folder, then "T\t<list>\t<file name>\t<todo json>" per todo file. */
export const READ_ALL = ["sh", "-c", `d=${ROOT}; [ -d "$d" ] || exit 0
for l in "$d"/*/; do
  [ -d "$l" ] || continue; n=$(basename "$l"); printf 'L\\t%s\\n' "$n"
  for f in "$l"*.json; do if [ -f "$f" ]; then printf 'T\\t%s\\t%s\\t%s\\n' "$n" "$(basename "$f" .json)" "$(tr -d '\\n' < "$f")"; fi; done
done`];

function parseTodo(file, json) {
  try {
    const value = JSON.parse(json);
    return isTodo(value) && value.id === file ? value : null;
  } catch {
    return null;
  }
}

/** { name, todos }[] sorted by name; bad lines are skipped. */
export function parseAll(stdout) {
  const lists = new Map();
  for (const line of (stdout ?? "").split("\n")) {
    const [kind, name, file, json] = line.split("\t");
    if (!name) continue;
    if (kind === "L" && !lists.has(name)) lists.set(name, []);
    const todo = kind === "T" ? parseTodo(file, json) : null;
    if (todo && lists.has(name)) lists.get(name).push(todo);
  }
  return [...lists].map(([name, todos]) => ({ name, todos })).sort((a, b) => a.name.localeCompare(b.name));
}

function checkedList(list) {
  const name = slug(list);
  if (!name) throw new Error("Bad list name");
  return name;
}

function checkedId(id) {
  if (!ID_PATTERN.test(id)) throw new Error("Bad todo id");
  return id;
}

/** Writes one todo file atomically: tmp, then mv. */
export function saveCommand(list, todo) {
  const script = `f=${ROOT}/"$1"/"$2".json; mkdir -p ${ROOT}/"$1" && printf '%s\\n' "$3" > "$f.tmp" && mv "$f.tmp" "$f"`;
  return ["sh", "-c", script, "sh", checkedList(list), checkedId(todo.id), JSON.stringify(todo)];
}

export function deleteCommand(list, id) {
  return ["sh", "-c", `rm -f ${ROOT}/"$1"/"$2".json`, "sh", checkedList(list), checkedId(id)];
}
