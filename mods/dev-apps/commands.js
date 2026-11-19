// Every script takes the project as $1; its files live in this folder.
const CACHE = '"$HOME/.cache/dev-apps/$1"';

export const READ_REGISTRY = ["sh", "-c", 'cat "${DEV_PORTS_REGISTRY:-$HOME/.config/dev-ports/registry.tsv}"'];

export const LISTENING = ["ss", "-ltnH"];

export const COMPOSE_SERVICES = ["docker", "compose", "config", "--services"];

export const COMPOSE_PS = ["docker", "compose", "ps", "-a", "--format", "json"];

// Herdr's exec kills every process it started when it returns, setsid ones too, so a user service runs the app.
const detached = (script, ...args) => ["systemd-run", "--user", "--quiet", "--collect", "--same-dir", "-E", "PATH", "sh", "-c", `mkdir -p ${CACHE} && ${script}`, "sh", ...args];

// Every watch started in this folder, by anyone: a pid file loses track once a second watch dies on the lock.
const KILL_WATCHES = `for p in $(pgrep -f "^docker compose watch"); do [ "$(readlink /proc/$p/cwd)" = "$(pwd -P)" ] || continue; kill -TERM "-$p" 2>/dev/null || kill -TERM "$p"; timeout 10 tail --pid="$p" -f /dev/null; done`;

const composeUp = `exec > ${CACHE}/docker.log 2>&1 < /dev/null && exec docker compose up -d`;

// The old watch goes before the log is emptied, or its shutdown lines land in the new log.
const composeWatch = `exec > /dev/null 2>&1 < /dev/null && ${KILL_WATCHES}; exec > ${CACHE}/docker.log 2>&1 && exec docker compose watch`;

const composeDown = `exec >> ${CACHE}/docker.log 2>&1 < /dev/null || exit; ${KILL_WATCHES}; exec docker compose down`;

const npmRun = `exec > ${CACHE}/"$2".log 2>&1 < /dev/null && echo $$ > ${CACHE}/"$2".pid && exec "$3" run "$2"`;

const KILL_STARTED = `for f in ${CACHE}/*.pid; do [ -f "$f" ] && kill -TERM "-$(cat "$f")" 2>/dev/null; rm -f "$f"; done`;

export function startCommands(project, launcher) {
  if (launcher.kind === "docker") return [detached(launcher.watch ? composeWatch : composeUp, project)];
  return launcher.scripts.map((script) => detached(npmRun, project, script, launcher.manager));
}

export function stopCommand(project, launcher) {
  if (launcher.kind === "docker") return detached(composeDown, project);
  return ["sh", "-c", KILL_STARTED, "sh", project];
}

// -a: compose's progress output makes grep call the log binary; sed drops color codes.
const ERROR_LINE = `grep -aiE "error|failed|unhealthy|cannot|ENOTFOUND" | tail -n 1 | sed 's/\\x1b\\[[0-9;]*m//g'`;

export function lastError(project, launcher) {
  const logs = launcher.kind === "docker" ? ["docker"] : launcher.scripts;
  return ["sh", "-c", `cd ${CACHE} && shift && cat -- "$@" 2>/dev/null | ${ERROR_LINE}`, "sh", project, ...logs.map((log) => `${log}.log`)];
}
