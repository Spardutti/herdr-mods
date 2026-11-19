import { test } from "node:test";
import { expect } from "../../test-support/expect.js";

import { SIZES, sizedOpen } from "./browser.js";

test("the sized windows are 1280 by 800 and 1920 by 1080", () => {
  expect(SIZES.map((s) => [s.label, s.width, s.height])).toEqual([["1280", 1280, 800], ["1920", 1920, 1080]]);
});

test("sizedOpen runs the window script with the link and the size", () => {
  const args = sizedOpen("C:/herdr/mods/dev-apps/open-sized.ps1", "http://localhost:4321", SIZES[0]);

  expect(args).toEqual(["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "C:/herdr/mods/dev-apps/open-sized.ps1",
    "-Url", "http://localhost:4321", "-Width", "1280", "-Height", "800"]);
});
