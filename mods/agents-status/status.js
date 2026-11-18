export const GROUPS = [
  { id: "needs", label: "NEEDS YOU", statuses: ["blocked", "done"] },
  { id: "working", label: "WORKING", statuses: ["working"] },
  { id: "idle", label: "IDLE", statuses: ["idle"] },
];

export function grouped(list) {
  return GROUPS
    .map((g) => ({ ...g, members: g.statuses.flatMap((s) => list.filter((a) => a.status === s)) }))
    .filter((g) => g.members.length);
}

export function firstNeedingYou(list) {
  return grouped(list).find((g) => g.id === "needs")?.members[0] ?? null;
}

export function age(ms) {
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return "<1m";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return hours < 24 ? `${hours}h` : `${Math.floor(hours / 24)}d`;
}

// Strips a leading status glyph and separator ("✳ Title", "⠋ - Title"), as Herdr's agents list does.
const LEADING_GLYPHS = /^[^\p{L}\p{N}\p{Ps}\p{Pi}]+/u;

export function displayName(a) {
  return (a.title ?? "").replace(LEADING_GLYPHS, "").trim() || a.tab_name;
}

// Done turns into idle when someone looks, which isn't the agent doing anything new.
const settled = (status) => (status === "done" ? "idle" : status);

export function track(changed, list, now) {
  const stale = list.filter((a) => changed[a.address]?.s !== settled(a.status));
  if (!stale.length) return changed;
  const next = { ...changed };
  for (const a of stale) next[a.address] = { s: settled(a.status), at: now };
  return next;
}
