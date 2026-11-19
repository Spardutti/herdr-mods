export function newReads() {
  let changes = 0, running = null;
  return {
    start: () => (running === null ? (running = changes) : null),
    finish: (seen) => {
      if (running === seen) running = null;
      return seen === changes;
    },
    invalidate: () => {
      changes += 1;
      running = null;
    },
  };
}
