import { test } from "node:test";
import assert from "node:assert/strict";
import { hasViewStack, listHeight, matchProjects, parseRepos, spaceFor } from "./projects.js";

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

test("listHeight fits its rows (3 rows: 138px), shows the status line when empty (36px), and caps at 8 rows (368px)", () => {
  assert.deepEqual([listHeight(3), listHeight(0), listHeight(12)], [138, 36, 368]);
});
