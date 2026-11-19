/** Tells whether a read started after the last change, so an older one can't put stale data back. */
export function newTracker() {
  let changes = 0;
  return { begin: () => changes, change: () => { changes += 1; }, isFresh: (seen) => seen === changes };
}
