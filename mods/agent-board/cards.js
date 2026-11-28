export const ORDER = ["blocked", "done", "working", "idle"];
export const LABELS = { blocked: "Needs you", done: "Done", working: "Working", idle: "Idle" };
export const EMPTY = "No agents running. Press Ctrl+K, pick a project and press Ctrl+Enter to start Claude there.";

// Herdr's agents list rule (mods/agents/main.js `clean`): drops status glyphs, keeps a leading emoji.
const LEADING_GLYPHS = /^(?:\[ [!.] \] |[✋⏳]\uFE0F?(?=\s)|(?!(?:\p{Emoji}\uFE0F|[#*]\u20E3))[^\p{L}\p{N}\p{Ps}\p{Pi}\p{Emoji_Presentation}])+/u;

const machineOf = (id) => (id.includes("/") ? id.split("/")[0] : null);
// Herdr's worktree dialog makes <dir>/worktrees/<repo>/<branch> and names the space after the branch.
const repoOf = (cwd) => /\/worktrees\/([^/]+)\//.exec(cwd ?? "")?.[1] ?? null;

function toCard(a, pane) {
  return {
    address: a.address,
    pane: a.pane,
    space: a.space,
    machine: machineOf(a.space),
    project: repoOf(pane?.cwd) ?? a.space_name,
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

export function prevCard(cards, focusedPane) {
  const at = cards.findIndex((c) => c.pane === focusedPane);
  return cards[((at < 0 ? 0 : at) - 1 + cards.length) % cards.length] ?? null;
}

export function needsYou(cards) {
  return cards.find((c) => c.status === "blocked") ?? cards.find((c) => c.status === "done") ?? null;
}

export function matchCards(cards, query) {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  return cards.filter((c) => {
    const text = [c.project, c.title, c.branch, c.agent].join(" ").toLowerCase();
    return words.every((w) => text.includes(w));
  });
}

export function filterCounts(agentList) {
  const counts = { all: agentList.length };
  for (const s of ORDER) counts[s] = agentList.filter((a) => a.status === s).length;
  return counts;
}

export function isWorktree(cwd) {
  return /\/worktrees\//.test(cwd ?? "");
}

const STEPS = { left: () => -1, right: () => 1, up: (cols) => -cols, down: (cols) => cols };

// Arrow moves on a grid filled row by row; a move off the grid stays put.
export function moveSelection(at, key, { count, cols }) {
  const next = at + (STEPS[key]?.(cols) ?? 0);
  return next >= 0 && next < count ? next : at;
}

const EMPTY_FILTER = { blocked: "Nobody needs you right now.", done: "No agents are done.", working: "No agents are working.", idle: "No agents are idle." };

export function emptyMessage(total, filter) {
  if (!total || filter === "all") return EMPTY;
  return `${EMPTY_FILTER[filter]} Pick All in the bar to see the other ${total}.`;
}

/** Whether closing the card's pane closes its whole space, which Herdr asks about first. */
export function lastInSpace(card, spaceList, paneList) {
  const tabs = new Set(spaceList.find((s) => s.id === card.space)?.tabs.map((t) => t.id) ?? []);
  return paneList.filter((p) => tabs.has(p.tab)).length === 1;
}

/** What closing the card's agent does, and the words that ask about it. */
export function closePrompt(card, spaceList, paneList) {
  return lastInSpace(card, spaceList, paneList)
    ? { title: `Close ${card.project}?`, detail: "It's the last agent in its space, so the space closes too.", command: { name: "space.close", args: { id: card.space, confirmed: true } } }
    : { title: `Close this ${card.project} agent?`, detail: "Only this agent closes; the rest of its space stays.", command: { name: "pane.close", args: { pane: card.pane } } };
}

/** The main checkout behind a worktree's git common dir; null for a bare repo, which has none. */
export function mainCheckout(commonDir) {
  return commonDir.endsWith("/.git") ? commonDir.slice(0, -5) : null;
}

export function othersInSpace(card, agentList) {
  return agentList.filter((a) => a.space === card.space && a.pane !== card.pane).length;
}
