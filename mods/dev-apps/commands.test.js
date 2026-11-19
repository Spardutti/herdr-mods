import { test } from "node:test";
import { expect } from "../../test-support/expect.js";

import { lastError, startCommands, stopCommand } from './commands.js'

const script = (argv) => argv?.[argv.indexOf('-c') + 1] ?? ''
const OUTSIDE_HERDR = ['systemd-run', '--user', '--quiet', '--collect', '--same-dir', '-E', 'PATH', 'sh', '-c']

for (const [what, argv] of [
  ['a docker start', startCommands('shop', { kind: 'docker', watch: true })[0]],
  ['a docker stop', stopCommand('shop', { kind: 'docker', watch: true })],
  ['an npm start', startCommands('shop', { kind: 'npm', scripts: ['dev'], manager: 'npm' })[0]],
]) {
  test(`${what} runs as a user service, so it outlives Herdr's call`, () => {
    expect(argv.slice(0, OUTSIDE_HERDR.length)).toEqual(OUTSIDE_HERDR)
  })
}

test('a docker project with develop.watch stops the watch already in its folder, then starts compose watch', () => {
  const started = script(startCommands('shop', { kind: 'docker', watch: true })[0])
  const [kill, watch] = [started.indexOf('kill -TERM'), started.indexOf('exec docker compose watch')]
  expect([started.includes('readlink /proc/$p/cwd'), kill >= 0 && kill < watch, started.endsWith('exec docker compose watch')]).toEqual([true, true, true])
})

test('a docker watch start empties its log only after the old watch is gone', () => {
  const started = script(startCommands('shop', { kind: 'docker', watch: true })[0])
  expect(started.indexOf('kill -TERM') < started.indexOf('> "$HOME/.cache/dev-apps/$1"/docker.log')).toBe(true)
})

test('a docker project without develop.watch starts with compose up -d', () => {
  expect(script(startCommands('shop', { kind: 'docker', watch: false })[0]).endsWith('exec docker compose up -d')).toBe(true)
})

test('stopping a docker project kills the watch before compose down', () => {
  const stopped = script(stopCommand('shop', { kind: 'docker', watch: true }))
  const [kill, down] = [stopped.indexOf('kill -TERM'), stopped.indexOf('docker compose down')]
  expect([stopped.includes('watch.pid'), kill >= 0 && kill < down]).toEqual([false, true])
})

test('a docker project reads its error line from docker.log', () => {
  expect(lastError('shop', { kind: 'docker', watch: true }).slice(4)).toEqual(['shop', 'docker.log'])
})

test('a node project reads its error line from each script log', () => {
  expect(lastError('shop', { kind: 'node', manager: 'npm', scripts: ['dev', 'admin'] }).slice(4)).toEqual(['shop', 'dev.log', 'admin.log'])
})
