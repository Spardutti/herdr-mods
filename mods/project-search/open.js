import { knownAgents, run, setShared } from "herdr";
import { spaceFor } from "./projects.js";

// The agent-board layout's stack and the shared key its bar reads.
function showWork() {
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
