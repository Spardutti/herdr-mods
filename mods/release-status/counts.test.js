import { test } from "node:test";
import { expect } from "../../test-support/expect.js";

import { parseCounts } from './counts.js'

test('rev-list counts read as behind then ahead', () => {
  expect(parseCounts('3\t5\n')).toEqual({ behind: 3, ahead: 5 })
  expect(parseCounts('')).toBeUndefined()
})
