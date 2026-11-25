/** Repos from `find ~/projects -maxdepth 4 -name .git` output, as { name, path }, sorted by name. */
export function parseRepos(stdout) {
  return stdout.split("\n").map((l) => l.trim()).filter((l) => l.endsWith("/.git"))
    .map((l) => {
      const path = l.slice(0, -"/.git".length);
      return { name: path.split("/").pop(), path };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Projects whose name or path holds every typed word, name matches first. */
export function matchProjects(list, query) {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const hasAll = (text) => words.every((w) => text.toLowerCase().includes(w));
  const byName = list.filter((p) => hasAll(p.name));
  const byPath = list.filter((p) => !hasAll(p.name) && hasAll(p.path));
  return [...byName, ...byPath];
}

/** The open space working in that project's folder, or null. */
export function spaceFor(project, spaceList) {
  return spaceList.find((s) => s.machine === "wsl" && s.folder === project.path) ?? null;
}
