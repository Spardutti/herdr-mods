import { exec, knownAgents, layout, notify, run, setShared } from "herdr";
import { hasViewStack, spaceFor } from "./projects.js";

// The agent-board layout's stack and the shared key its bar reads.
function showWork() {
  if (!hasViewStack(layout())) return;
  run("layout.select", { stack: "view", child: "work" });
  setShared("agent-board.view", "work");
}

function openIn(project, spaceList, extra) {
  const space = spaceFor(project, spaceList);
  if (space) run("tab.new", { space: space.id, folder: project.path, ...extra });
  else run("space.new", { folder: project.path, machine: "wsl", ...extra });
  showWork();
}

export function openTerminal(project, spaceList) {
  openIn(project, spaceList, {});
}

export async function openAgent(project, spaceList) {
  const list = await knownAgents({ on: "wsl" }).catch(() => []);
  const argv = list.find((a) => a.key === "claude" && a.installed)?.run ?? ["claude"];
  openIn(project, spaceList, { argv });
}

// The name arrives as $1, never inside the script, so the shell cannot run it.
const INIT = ["-c", 'p="$HOME/projects/$1" && git init -q -b main "$p" && echo "$p"', "sh"];

export async function createProject(name, agent) {
  const r = await exec("sh", [...INIT, name], { on: "wsl" }).catch(() => null);
  if (r?.code !== 0) return notify({ title: `Could not create ${name}`, body: r?.stderr.trim(), level: "error" });
  const project = { name, path: r.stdout.trim() };
  if (agent) await openAgent(project, []);
  else openTerminal(project, []);
}
