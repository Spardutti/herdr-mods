export function parseCounts(stdout) {
  const [behind = NaN, ahead = NaN] = stdout.trim().split(/\s+/).map(Number);
  return Number.isFinite(behind) && Number.isFinite(ahead) ? { behind, ahead } : undefined;
}
