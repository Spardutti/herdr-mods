const lastPart = (path) => path.replace(/\/+$/, "").split("/").pop() ?? "";

export function projectName(commonDir, cwd) {
  const dir = commonDir?.trim();
  if (!dir) return lastPart(cwd);
  return lastPart(dir.endsWith("/.git") ? dir.slice(0, -"/.git".length) : dir);
}
