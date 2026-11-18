import { parseCounts } from "./counts.js";

export const BASE = "main";
// The dev branch's usual names, tried in this order.
export const DEV_NAMES = ["develop", "dev", "development"];

async function devBranch(git) {
  for (const name of DEV_NAMES) if ((await hasRef(git, name)) || (await hasRef(git, `origin/${name}`))) return name;
  return null;
}

const hasRef = async (git, ref) => (await git(["rev-parse", "--verify", "-q", ref])) !== undefined;

// Branches other than yours are read from origin, since local copies of them go stale.
async function refOf(git, name, branch) {
  return name !== branch && (await hasRef(git, `origin/${name}`)) ? `origin/${name}` : name;
}

// A merge whose side branch holds no commits missing from base (a sync from main) has nothing to release.
async function bringsWork(git, base, hash) {
  return (await git(["rev-list", "--no-merges", "--count", `${base}..${hash}^2`]))?.trim() !== "0";
}

async function unreleased(git, base, ref) {
  const lines = ((await git(["log", "--first-parent", "--format=%H %s", `${base}..${ref}`])) ?? "").split("\n").filter(Boolean);
  const kept = [];
  for (const line of lines) {
    const [hash = "", ...subject] = line.split(" ");
    if (await bringsWork(git, base, hash)) kept.push(subject.join(" "));
  }
  return kept;
}

async function behindBy(git, base, ref) {
  return parseCounts((await git(["rev-list", "--no-merges", "--left-right", "--count", `${base}...${ref}`])) ?? "")?.behind ?? 0;
}

/** The dev branch's merges that main lacks (sync merges dropped), and how many commits main has that it lacks. */
export async function releaseStatus(git) {
  const branch = (await git(["rev-parse", "--abbrev-ref", "HEAD"]))?.trim();
  if (!branch) return { branch: "", error: "Not a git repository." };
  const from = (await hasRef(git, BASE)) ? await devBranch(git) : null;
  if (!from) return { branch };
  const base = await refOf(git, BASE, branch), ref = await refOf(git, from, branch);
  return { branch, release: { from, merges: await unreleased(git, base, ref), behind: await behindBy(git, base, ref) } };
}
