import { exec, knownAgents, layout, notify, run, setShared } from "herdr";
import { INIT_SCRIPT, hasViewStack, spaceFor } from "./projects.js";

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


export async function createProject(name, agent) {
  const r = await exec("sh", ["-c", INIT_SCRIPT, "sh", name], { on: "wsl" }).catch(() => null);
  if (r?.code !== 0) return notify({ title: `Could not create ${name}`, body: r?.stderr.trim(), level: "error" });
  const project = { name, path: r.stdout.trim() };
  if (agent) await openAgent(project, []);
  else openTerminal(project, []);
}
