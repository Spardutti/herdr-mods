/** Repos from `find ~/projects -maxdepth 4 -name .git` output, as { name, path }, sorted by name. */
export function parseRepos(stdout) {
  return stdout.split("\n").map((l) => l.trim()).filter((l) => l.endsWith("/.git"))
    .map((l) => {
      const path = l.slice(0, -"/.git".length);
      return { name: path.split("/").pop(), path };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function matchProjects(list, query) {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const hasAll = (text) => words.every((w) => text.toLowerCase().includes(w));
  const byName = list.filter((p) => hasAll(p.name));
  const byPath = list.filter((p) => !hasAll(p.name) && hasAll(p.path));
  return [...byName, ...byPath];
}

function findNode(node, id) {
  if (!node || node.id === id) return node ?? null;
  for (const child of node.children ?? []) {
    const found = findNode(child, id);
    if (found) return found;
  }
  return null;
}

// The agent-board layout, or any copy of it, is the one with a "view" stack.
export function hasViewStack(tree) {
  return findNode(tree, "view") !== null;
}

export function spaceFor(project, spaceList) {
  return spaceList.find((s) => s.machine === "wsl" && s.folder === project.path) ?? null;
}
