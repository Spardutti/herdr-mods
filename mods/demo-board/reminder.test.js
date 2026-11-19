import { test } from "node:test";
import { expect } from "../../test-support/expect.js";

import { reminderFor } from "./reminder.js";

const URL = "https://claude.ai/artifact/a1";

test("a new PR on a project with a board asks for its demo steps", () => {
  expect(reminderFor("gh pr create --fill", URL)).toBe(
    `This project has a demo board: ${URL}. Load the demo-board skill and add the demo steps for the PR you just opened.`,
  );
});

test("a project with its board off gets no reminder", () => {
  expect(reminderFor("gh pr create --fill", null)).toBe(null);
});

test("other gh pr commands get no reminder", () => {
  expect(reminderFor("gh pr view 12", URL)).toBe(null);
});

test("a PR opened at the end of a chained command still counts", () => {
  expect(reminderFor("git push && gh  pr create -t x", URL)?.includes(URL)).toBe(true);
});
