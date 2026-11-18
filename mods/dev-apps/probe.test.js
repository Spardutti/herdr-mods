import { test } from "node:test";
import assert from "node:assert/strict";
import { appUrl, loadProject, pollProject, startProject, stopProject } from "./probe.js";
import { COMPOSE_PS, COMPOSE_SERVICES, LISTENING, READ_REGISTRY, startCommands, stopCommand } from "./commands.js";

const ROOT = "/home/me/shadowboard";
const COMPOSE = "services:\n  web:\n    ports:\n      - 6004:3000\n";

function machine(answers, files = {}) {
  const ran = [];
  const sh = async (argv, cwd) => { ran.push(argv); return answers[argv.join(" ")]; };
  const read = async (path) => files[path] ?? null;
  return { sh, read, ran };
}

const shadowboard = (more = {}) => machine({
  "git rev-parse --path-format=absolute --git-common-dir": `${ROOT}/.git\n`,
  "git rev-parse --show-toplevel": `${ROOT}\n`,
  [READ_REGISTRY.join(" ")]: "6004\tshadowboard\tweb\n5432\tshadowboard\tpostgres\n",
  "ls -A": "compose.yaml\n.env\n",
  [COMPOSE_SERVICES.join(" ")]: "web\ndb\n",
  ...more,
}, { [`${ROOT}/compose.yaml`]: COMPOSE });

const project = (more = {}) => ({
  name: "shadowboard", root: ROOT, apps: [{ service: "web", port: 6004 }],
  launcher: { kind: "docker", watch: false }, listening: [], serviceNames: ["web", "db"], ...more,
});

test("loadProject finds the project's browser apps and its docker launcher", async () => {
  const { sh, read } = shadowboard();

  assert.deepEqual(await loadProject(sh, read, `${ROOT}/src`), project());
});

test("loadProject for a project with no browser app in dev-ports returns null", async () => {
  const { sh, read } = machine({ "git rev-parse --show-toplevel": "/home/me/acomer\n", [READ_REGISTRY.join(" ")]: "6432\tacomer\tpostgres\n" });

  assert.equal(await loadProject(sh, read, "/home/me/acomer"), null);
});

test("pollProject reads the listening ports and the containers' states", async () => {
  const ps = '{"Service":"web","State":"running"}\n{"Service":"db","State":"exited","ExitCode":1}';
  const { sh } = machine({ [LISTENING.join(" ")]: "LISTEN 0 4096 0.0.0.0:6004 0.0.0.0:*", [COMPOSE_PS.join(" ")]: ps });

  const polled = await pollProject(sh, project({ startedAt: 5 }), 10);

  assert.deepEqual([polled.listening, polled.services, polled.startedAt],
    [[6004], [{ name: "web", state: "running" }, { name: "db", state: "crashed", exitCode: 1 }], undefined]);
});

test("pollProject keeps a start pending while its app is not up yet", async () => {
  const { sh } = machine({ [LISTENING.join(" ")]: "" });

  assert.equal((await pollProject(sh, project({ startedAt: 5 }), 10)).startedAt, 5);
});

test("startProject runs the launcher's start command and marks the project starting", async () => {
  const { sh, ran } = shadowboard();

  const started = await startProject(sh, project(), 1000);

  assert.deepEqual([started.startedAt, ran.at(-1)], [1000, startCommands("shadowboard", { kind: "docker", watch: false })[0]]);
});

test("startProject while a start pressed 10 s ago is still running starts nothing", async () => {
  const { sh, ran } = shadowboard();

  await startProject(sh, project({ startedAt: 0 }), 10_000);

  assert.deepEqual(ran, []);
});

test("stopProject runs the stop command and marks the project stopping", async () => {
  const { sh, ran } = shadowboard();

  const stopped = await stopProject(sh, project({ startedAt: 3 }), 2000);

  assert.deepEqual([stopped.stoppingAt, stopped.startedAt, ran], [2000, undefined, [stopCommand("shadowboard", { kind: "docker", watch: false })]]);
});

test("appUrl builds a localhost link from the app's port", () => {
  assert.equal(appUrl({ port: 6004 }), "http://localhost:6004");
});

test("appUrl refuses a port that is not a whole number in range", () => {
  assert.deepEqual([appUrl({ port: 70000 }), appUrl({ port: "6004/evil" })], [null, null]);
});
