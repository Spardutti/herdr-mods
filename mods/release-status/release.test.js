import { test } from "node:test";
import assert from "node:assert/strict";
import { releaseStatus } from "./release.js";

function fakeGit(answers) {
  return async (args) => answers[args.join(" ")];
}

function repo({ head = "develop", origin = false, log = "", counts = {}, drift = "0\t0", develop = true } = {}) {
  const [base, ref] = origin ? ["origin/main", "origin/develop"] : ["main", "develop"];
  const answers = {
    "rev-parse --abbrev-ref HEAD": `${head}\n`,
    "rev-parse --verify -q main": "a\n",
    ...(develop ? { "rev-parse --verify -q develop": "b\n" } : {}),
    ...(origin ? { "rev-parse --verify -q origin/main": "c\n", "rev-parse --verify -q origin/develop": "d\n" } : {}),
    [`log --first-parent --format=%H %s ${base}..${ref}`]: log,
    [`rev-list --no-merges --left-right --count ${base}...${ref}`]: drift,
  };
  for (const [hash, n] of Object.entries(counts)) answers[`rev-list --no-merges --count ${base}..${hash}^2`] = `${n}\n`;
  return fakeGit(answers);
}

test("releaseStatus lists develop's merges that main lacks, newest first", async () => {
  const git = repo({ log: "h2 Merge PR #2\nh1 Merge PR #1\n", counts: { h2: 3, h1: 1 } });

  assert.deepEqual(await releaseStatus(git), { branch: "develop", release: { merges: ["Merge PR #2", "Merge PR #1"], behind: 0 } });
});

test("releaseStatus skips a merge of main back into develop: it brings no work", async () => {
  const git = repo({ log: "h3 Merge branch 'main' into develop\n", counts: { h3: 0 } });

  assert.deepEqual((await releaseStatus(git)).release.merges, []);
});

test("releaseStatus counts commits on main that develop lacks as behind", async () => {
  assert.equal((await releaseStatus(repo({ drift: "2\t0\n" }))).release.behind, 2);
});

test("releaseStatus outside a git repository says so", async () => {
  assert.deepEqual(await releaseStatus(fakeGit({})), { branch: "", error: "Not a git repository." });
});

test("releaseStatus in a repo without develop has no release", async () => {
  assert.deepEqual(await releaseStatus(repo({ head: "main", develop: false })), { branch: "main" });
});

test("releaseStatus on a feature branch reads main and develop from origin", async () => {
  const git = repo({ head: "feat/login", origin: true, log: "h4 Merge PR #4\n", counts: { h4: 2 } });

  assert.deepEqual((await releaseStatus(git)).release.merges, ["Merge PR #4"]);
});
