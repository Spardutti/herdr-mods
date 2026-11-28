import { agents, exec, knownAgents, openOverlay, panes, run, setShared, spaces } from "herdr";
import { closePrompt, mainCheckout, othersInSpace } from "./cards.js";

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

async function mainCheckoutOf(card) {
  const r = await exec("git", ["-C", card.cwd, "rev-parse", "--path-format=absolute", "--git-common-dir"], { on: card.machine }).catch(() => null);
  return r?.code === 0 ? mainCheckout(r.stdout.trim()) : null;
}

/** Claude in a new tab of the card's repo: a worktree card's agent goes to the main checkout's space. */
export async function newAgent(card) {
  const argv = await claudeArgv(card.machine);
  const main = card.worktree && card.cwd ? await mainCheckoutOf(card) : null;
  if (!main) return run("tab.new", { name: "Claude Code", space: card.space, argv, focus: false });
  const home = spaces().find((s) => s.machine === card.machine && s.folder === main);
  if (home) run("tab.new", { name: "Claude Code", space: home.id, folder: main, argv, focus: false });
  else run("space.new", { folder: main, machine: card.machine ?? "", argv, focus: false });
}

/** Closes the agent's pane after asking; in a worktree the question offers removing it too. */
export function closeCard(card) {
  const { title, detail, command } = closePrompt(card, spaces(), panes());
  if (card.worktree) {
    return openOverlay({ mod: "worktree-dev", kind: "dialog", width: 460, height: 280, props: { space: card.space, folder: card.cwd, action: "remove", keep: command, others: othersInSpace(card, agents()) } });
  }
  openOverlay({ mod: "agent-board", kind: "dialog", width: 420, height: 150, props: { part: "close", title, detail, command } });
}

export async function newWorktreeAgent(spaceId, folder, machine) {
  const argv = await claudeArgv(machine);
  openOverlay({ mod: "worktree-dev", kind: "dialog", width: 460, height: 280, props: { space: spaceId, folder, action: "new", argv } });
}
