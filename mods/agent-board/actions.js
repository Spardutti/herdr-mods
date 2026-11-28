import { knownAgents, openOverlay, panes, run, setShared, spaces } from "herdr";
import { keepWorktreeCommand, lastInSpace } from "./cards.js";

export const VIEW = "agent-board.view";

/** Claude Code's start command on that machine, or plain `claude` when the check fails. */
export async function claudeArgv(machine) {
  const list = await knownAgents({ on: machine }).catch(() => []);
  return list.find((a) => a.key === "claude" && a.installed)?.run ?? ["claude"];
}

function select(child) {
  run("layout.select", { stack: "view", child });
  setShared(VIEW, child);
}

export function openChat(card) {
  run("pane.focus", { pane: card.pane });
  select("work");
}

export function showBoard() {
  select("board");
  run("agent-board.grab");
}

export async function newAgent(spaceId, machine) {
  run("tab.new", { name: "Claude Code", space: spaceId, argv: await claudeArgv(machine), focus: false });
}

/** Closes the agent's pane; a worktree, or the space's last agent, asks first. */
export function closeCard(card) {
  if (card.worktree) {
    const keep = keepWorktreeCommand(card, spaces(), panes());
    return openOverlay({ mod: "worktree-dev", kind: "dialog", width: 460, height: 280, props: { space: card.space, folder: card.cwd, action: "remove", keep } });
  }
  if (lastInSpace(card, spaces(), panes())) return openOverlay({ mod: "agent-board", kind: "dialog", width: 420, height: 150, props: { part: "close", space: card.space, name: card.project } });
  run("pane.close", { pane: card.pane });
}

export async function newWorktreeAgent(spaceId, folder, machine) {
  const argv = await claudeArgv(machine);
  openOverlay({ mod: "worktree-dev", kind: "dialog", width: 460, height: 280, props: { space: spaceId, folder, action: "new", argv } });
}
