const OPENS_PR = /\bgh\s+pr\s+create\b/;

/** The note Claude gets after a Bash call: demo steps to add for a new PR, or null. */
export function reminderFor(command, url) {
  if (!url || !OPENS_PR.test(command ?? "")) return null;
  return `This project has a demo board: ${url}. Load the demo-board skill and add the demo steps for the PR you just opened.`;
}
