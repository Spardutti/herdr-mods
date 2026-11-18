import { test } from "node:test";
import assert from "node:assert/strict";
import { releaseStatus } from "./release.js";

function fakeGit(answers) {
  return async (args) => answers[args.join(" ")];
}

function repo({ head = "develop", origin = false, log = "", counts = {}, drift = "0\t0", dev = "develop", localDev = true } = {}) {
  const [base, ref] = origin ? ["origin/main", `origin/${dev}`] : ["main", dev];
  const answers = {
    "rev-parse --abbrev-ref HEAD": `${head}\n`,
    "rev-parse --verify -q main": "a\n",
    ...(dev && localDev ? { [`rev-parse --verify -q ${dev}`]: "b\n" } : {}),
    ...(origin ? { "rev-parse --verify -q origin/main": "c\n", [`rev-parse --verify -q origin/${dev}`]: "d\n" } : {}),
    [`log --first-parent --format=%H %s ${base}..${ref}`]: log,
    [`rev-list --no-merges --left-right --count ${base}...${ref}`]: drift,
  };
  for (const [hash, n] of Object.entries(counts)) answers[`rev-list --no-merges --count ${base}..${hash}^2`] = `${n}\n`;
  return fakeGit(answers);
}

test("releaseStatus lists develop's merges that main lacks, newest first", async () => {
  const git = repo({ log: "h2 Merge PR #2\nh1 Merge PR #1\n", counts: { h2: 3, h1: 1 } });

  assert.deepEqual(await releaseStatus(git), { branch: "develop", release: { from: "develop", merges: ["Merge PR #2", "Merge PR #1"], behind: 0 } });
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

test("releaseStatus in a repo without a dev branch has no release", async () => {
  assert.deepEqual(await releaseStatus(repo({ head: "main", dev: null })), { branch: "main" });
});

test("releaseStatus finds a dev branch that only exists on origin", async () => {
  const git = repo({ head: "feat/x", origin: true, dev: "development", localDev: false, log: "h6 Merge PR #6\n", counts: { h6: 1 } });

  assert.deepEqual((await releaseStatus(git)).release, { from: "development", merges: ["Merge PR #6"], behind: 0 });
});

for (const dev of ["dev", "development"]) {
  test(`releaseStatus reads a dev branch named ${dev}`, async () => {
    const git = repo({ head: dev, dev, log: "h5 Merge PR #5\n", counts: { h5: 1 } });

    assert.deepEqual((await releaseStatus(git)).release, { from: dev, merges: ["Merge PR #5"], behind: 0 });
  });
}

test("releaseStatus on a feature branch reads main and develop from origin", async () => {
  const git = repo({ head: "feat/login", origin: true, log: "h4 Merge PR #4\n", counts: { h4: 2 } });

  assert.deepEqual((await releaseStatus(git)).release.merges, ["Merge PR #4"]);
});
