import { test } from "node:test";
import assert from "node:assert/strict";
import { MAX_ROWS, hasViewStack, listHeight, matchProjects, parseRepos, spaceFor, withCreateRow } from "./projects.js";

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
