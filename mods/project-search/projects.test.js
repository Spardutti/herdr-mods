import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { INIT_SCRIPT, MAX_ROWS, hasViewStack, listHeight, matchProjects, parseRepos, spaceFor, withCreateRow } from "./projects.js";

const p = (name, path = `/h/projects/${name}`) => ({ name, path });

test("parseRepos turns \"/h/projects/a/app/.git\\n\" into [{ name: \"app\", path: \"/h/projects/a/app\" }]", () => {
  assert.deepEqual(parseRepos("/h/projects/a/app/.git\n"), [{ name: "app", path: "/h/projects/a/app" }]);
});

test("parseRepos sorts by name and skips lines that are not a .git folder", () => {
  const out = "/h/projects/zed/.git\nfind: denied\n/h/projects/x/alpha/.git\n";

  assert.deepEqual(parseRepos(out).map((r) => r.name), ["alpha", "zed"]);
});

test("matchProjects(list, \"herdr mods\") keeps herdr-mods and drops herdr-themes", () => {
  const list = [p("herdr-mods"), p("herdr-themes")];

  assert.deepEqual(matchProjects(list, "herdr mods").map((r) => r.name), ["herdr-mods"]);
});

test("matchProjects puts a name match before a path-only match", () => {
  const list = [p("shadowboard", "/h/projects/stealth/shadowboard"), p("stealth-app", "/h/projects/x/stealth-app")];

  assert.deepEqual(matchProjects(list, "Stealth").map((r) => r.name), ["stealth-app", "shadowboard"]);
});

test("matchProjects with an empty query keeps every project", () => {
  assert.equal(matchProjects([p("a"), p("b")], "  ").length, 2);
});

test("spaceFor finds the wsl space with folder /h/projects/a/app, and null when none has it", () => {
  const spaces = [{ id: "s0", machine: null, folder: "/h/projects/a/app" }, { id: "wsl/s2", machine: "wsl", folder: "/h/projects/other" }, { id: "wsl/s1", machine: "wsl", folder: "/h/projects/a/app" }];

  assert.deepEqual([spaceFor(p("app", "/h/projects/a/app"), spaces)?.id, spaceFor(p("b"), spaces)], ["wsl/s1", null]);
});

test("hasViewStack finds the board's \"view\" stack in any layout tree, a copy included, and not in one without it", () => {
  const board = { id: "root", children: [{ id: "bar" }, { id: "view", type: "stack", children: [] }] };
  const other = { id: "root", children: [{ id: "sidebar", children: [{ id: "spaces" }] }] };

  assert.deepEqual([hasViewStack(board), hasViewStack(other), hasViewStack(null)], [true, false, false]);
});

test("listHeight fits its rows with a gap only between them (3 rows: 136px), and shows the status line when empty (36px)", () => {
  assert.deepEqual([listHeight(3), listHeight(0)], [136, 36]);
});

test("listHeight has room for every row the search returns: MAX_ROWS rows need MAX_ROWS * 44 + gaps", () => {
  assert.equal(listHeight(MAX_ROWS), MAX_ROWS * 44 + (MAX_ROWS - 1) * 2);
});

test("withCreateRow adds a create row for \"ajyatch\" when no repo has that name", () => {
  const matches = [p("ajyatch-old")];

  assert.deepEqual(withCreateRow(matches, matches, " ajyatch "), [p("ajyatch-old"), { name: "ajyatch", create: true }]);
});

test("withCreateRow adds no create row when a repo already has that exact name", () => {
  const repos = [p("ajyatch")];

  assert.deepEqual(withCreateRow(repos, repos, "ajyatch"), [p("ajyatch")]);
});

for (const query of ["", "my app", "../etc", ".hidden", "a/b", "x;rm"]) {
  test(`withCreateRow refuses ${JSON.stringify(query)} as a new project name`, () => {
    assert.deepEqual(withCreateRow([], [], query), []);
  });
}

test("withCreateRow accepts letters, digits, dot, dash and underscore: \"my_app-2.0\"", () => {
  assert.deepEqual(withCreateRow([], [], "my_app-2.0"), [{ name: "my_app-2.0", create: true }]);
});

test("withCreateRow offers \"api\" when the only repo named api is deeper, at /h/projects/work/api", () => {
  const repos = [p("api", "/h/projects/work/api")];

  assert.deepEqual(withCreateRow(repos, repos, "api").at(-1), { name: "api", create: true });
});

test("withCreateRow keeps the create row inside MAX_ROWS when the matches already fill it", () => {
  const matches = Array.from({ length: MAX_ROWS }, (_, i) => p(`api-${i}`));

  const rows = withCreateRow(matches, matches, "api");

  assert.deepEqual([rows.length, rows.at(-1)], [MAX_ROWS, { name: "api", create: true }]);
});

const initIn = (home, name) => spawnSync("sh", ["-c", INIT_SCRIPT, "sh", name], { env: { ...process.env, HOME: home }, encoding: "utf8" });

test("INIT_SCRIPT makes ~/projects/new-app a repo on branch main and prints its path", () => {
  const home = mkdtempSync(join(tmpdir(), "ps-"));

  const r = initIn(home, "new-app");

  assert.deepEqual([r.status, r.stdout.trim(), readFileSync(join(home, "projects/new-app/.git/HEAD"), "utf8")], [0, join(home, "projects/new-app"), "ref: refs/heads/main\n"]);
});

test("INIT_SCRIPT turns an empty folder the user made into a repo", () => {
  const home = mkdtempSync(join(tmpdir(), "ps-"));
  mkdirSync(join(home, "projects/empty"), { recursive: true });

  assert.equal(initIn(home, "empty").status, 0);
});

test("INIT_SCRIPT refuses a folder that already holds files, and leaves it without a .git", () => {
  const home = mkdtempSync(join(tmpdir(), "ps-"));
  mkdirSync(join(home, "projects/personal/inner"), { recursive: true });

  const r = initIn(home, "personal");

  assert.deepEqual([r.status, existsSync(join(home, "projects/personal/.git"))], [1, false]);
});
