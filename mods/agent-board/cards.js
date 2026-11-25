export const ORDER = ["blocked", "done", "working", "idle"];

// Strips a leading status glyph and separator ("✳ Title", "⠋ - Title"), as Herdr's agents list does.
const LEADING_GLYPHS = /^[^\p{L}\p{N}\p{Ps}\p{Pi}]+/u;

const machineOf = (id) => (id.includes("/") ? id.split("/")[0] : null);

function toCard(a, pane) {
  return {
    address: a.address,
    pane: a.pane,
    space: a.space,
    machine: machineOf(a.space),
    project: a.space_name,
    status: a.status,
    agent: a.program?.name ?? a.app ?? "agent",
    title: (a.title ?? "").replace(LEADING_GLYPHS, "").trim() || a.tab_name,
    cwd: pane?.cwd ?? null,
    branch: pane?.branch ?? null,
    worktree: isWorktree(pane?.cwd),
  };
}

/** Agents as cards in Herdr's space, tab, pane order, so a status change never moves a card. */
export function boardCards(agentList, paneList, filter) {
  const panesById = new Map(paneList.map((p) => [p.pane, p]));
  return agentList.filter((a) => filter === "all" || a.status === filter)
    .map((a) => toCard(a, panesById.get(a.pane)));
}

/** The card after the focused one, wrapping; the first when none is focused. */
export function nextCard(cards, focusedPane) {
  const at = cards.findIndex((c) => c.pane === focusedPane);
  return cards[(at + 1) % cards.length] ?? null;
}

/** The card before the focused one, wrapping; the last when none is focused. */
export function prevCard(cards, focusedPane) {
  const at = cards.findIndex((c) => c.pane === focusedPane);
  return cards[((at < 0 ? 0 : at) - 1 + cards.length) % cards.length] ?? null;
}

/** The first card that needs you, else the first one that finished. */
export function needsYou(cards) {
  return cards.find((c) => c.status === "blocked") ?? cards.find((c) => c.status === "done") ?? null;
}

/** Cards whose project, title, branch or agent holds every typed word. */
export function matchCards(cards, query) {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  return cards.filter((c) => {
    const text = [c.project, c.title, c.branch, c.agent].join(" ").toLowerCase();
    return words.every((w) => text.includes(w));
  });
}

/** How many agents each filter chip would show, "all" included. */
export function filterCounts(agentList) {
  const counts = { all: agentList.length };
  for (const s of ORDER) counts[s] = agentList.filter((a) => a.status === s).length;
  return counts;
}

/** True when the folder is a checkout Herdr's worktree dialog made. */
export function isWorktree(cwd) {
  return /\/worktrees\//.test(cwd ?? "");
}
