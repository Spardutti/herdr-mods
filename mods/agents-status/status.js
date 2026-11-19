const URGENCY = { blocked: 0, done: 1, working: 2, idle: 3 };

/** Agents grouped by space, most urgent space first; inside one, most urgent chat first. Ties: most recent first. */
export function byProject(list, changed) {
  const when = (a) => changed[a.address]?.at ?? 0;
  const sorted = [...list].sort((x, y) => URGENCY[x.status] - URGENCY[y.status] || when(y) - when(x));
  const spaces = new Map();
  for (const a of sorted) spaces.set(a.space, [...(spaces.get(a.space) ?? []), a]);
  return [...spaces].map(([id, members]) => ({ id, name: members[0].space_name, members }));
}

/** The first chat drawn that is blocked or done, so the needs key matches the panel. */
export function firstNeedingYou(list, changed) {
  const drawn = byProject(list, changed).flatMap((p) => p.members);
  return drawn.find((a) => URGENCY[a.status] <= URGENCY.done) ?? null;
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
