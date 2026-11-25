import { knownAgents, openOverlay, run, setShared } from "herdr";

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

/** Shows the card's chat: focuses its pane, then switches the view stack to the work column. */
export function openChat(card) {
  run("pane.focus", { pane: card.pane });
  select("work");
}

/** Switches the view stack back to the board. */
export function showBoard() {
  select("board");
}

/** Starts Claude Code in a new tab of that space. */
export async function newAgent(spaceId, machine) {
  run("tab.new", { name: "Claude Code", space: spaceId, argv: await claudeArgv(machine), focus: false });
}

/** Opens the shipped worktree dialog, which starts Claude Code in the new checkout's space. */
export async function newWorktreeAgent(spaceId, folder, machine) {
  const argv = await claudeArgv(machine);
  openOverlay({ mod: "worktree", kind: "dialog", width: 460, height: 280, props: { space: spaceId, folder, action: "new", argv } });
}
