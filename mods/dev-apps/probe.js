import { COMPOSE_PS, COMPOSE_SERVICES, LISTENING, READ_REGISTRY, lastError, startCommands, stopCommand } from "./commands.js";
import { isAnyUp, serviceNames, servicesOf } from "./containers.js";
import { COMPOSE_FILES, launcherFor } from "./launch.js";
import { projectName } from "./project.js";
import { browserApps } from "./registry.js";
import { isBusy, listeningPorts, statusOf } from "./running.js";

// `sh(argv, cwd?)` runs a command on the space's machine: its stdout, or undefined when it failed.
// `read(path)` reads a file there: its text, or null when absent.

async function sourcesOf(sh, read, root) {
  const files = ((await sh(["ls", "-A"], root)) ?? "").split("\n").filter(Boolean);
  const composeFile = COMPOSE_FILES.find((file) => files.includes(file));
  const text = async (name) => (await read(`${root}/${name}`)) ?? undefined;
  return {
    compose: composeFile ? await text(composeFile) : undefined,
    env: await text(".env"),
    pkg: files.includes("package.json") ? await text("package.json") : undefined,
    files,
  };
}

/** This project's browser apps from dev-ports, and how to start them; null when it has none. */
export async function loadProject(sh, read, cwd) {
  const commonDir = await sh(["git", "rev-parse", "--path-format=absolute", "--git-common-dir"], cwd);
  const root = (await sh(["git", "rev-parse", "--show-toplevel"], cwd))?.trim() || cwd;
  const name = projectName(commonDir, cwd);
  const apps = browserApps((await sh(READ_REGISTRY)) ?? "", name);
  if (!apps.length) return null;
  const launcher = launcherFor(await sourcesOf(sh, read, root), apps.map((app) => app.port));
  const project = { name, root, apps, launcher, listening: [] };
  if (launcher?.kind !== "docker") return project;
  return { ...project, serviceNames: serviceNames(await sh(COMPOSE_SERVICES, root)) };
}

/** The project with fresh listening ports and container states; clears a finished start or stop. */
export async function pollProject(sh, project, now) {
  const [ss, ps] = await Promise.all([sh(LISTENING), project.serviceNames ? sh(COMPOSE_PS, project.root) : undefined]);
  const listening = listeningPorts(ss ?? "");
  const services = project.serviceNames && servicesOf(ps ?? "", project.serviceNames);
  const isAllUp = project.apps.every((app) => listening.includes(app.port));
  const isAllDown = !project.apps.some((app) => listening.includes(app.port)) && !isAnyUp(services);
  const next = { ...project, listening, services, startedAt: isAllUp ? undefined : project.startedAt, stoppingAt: isAllDown ? undefined : project.stoppingAt };
  if (!next.launcher || next.failure !== undefined || statusOf(isAllUp, next, now) !== "failed") return next;
  const failure = (await sh(lastError(next.name, next.launcher)))?.trim();
  return failure ? { ...next, failure } : next;
}

/** Starts the project's apps unless a start or stop is still running; returns the project marked starting. */
export async function startProject(sh, project, now) {
  if (!project.launcher || isBusy(project, now)) return project;
  const config = project.serviceNames && (await sh(COMPOSE_SERVICES, project.root));
  const started = { ...project, startedAt: now, stoppingAt: undefined, failure: undefined, ...(config ? { serviceNames: serviceNames(config) } : {}) };
  for (const argv of startCommands(project.name, project.launcher)) await sh(argv, project.root);
  return started;
}

/** Stops everything the project runs; returns the project marked stopping. */
export async function stopProject(sh, project, now) {
  if (!project.launcher) return project;
  await sh(stopCommand(project.name, project.launcher), project.root);
  return { ...project, startedAt: undefined, stoppingAt: now };
}

/** The link for an app, built only from localhost and its numeric port. */
export function appUrl(app) {
  const port = app.port;
  return Number.isInteger(port) && port > 0 && port < 65536 ? `http://localhost:${port}` : null;
}
