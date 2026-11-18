# herdr-mods

Mods for the [Herdr](https://herdr.dev) desktop app, plus two helpers for running it with WSL.

| Part | What it does | Runs on |
| --- | --- | --- |
| [`agents-status`](#agents-status) | The Agents list grouped by what needs you: **Needs you**, **Working**, **Idle**. F8 jumps to the top one. | any |
| [`release-status`](#release-status) | What's waiting on the dev branch to go to `main`, for the space you're in. | any |
| [`dev-apps`](#dev-apps) | The space's browser apps: running or not, a link, Start and Stop. | Linux or WSL spaces |
| [`blocked-run`](#blocked-run) | Commands auto mode blocked, or Claude asked you to run, with a **Run it** button. | Linux or WSL spaces |
| [`resume`](#resume) | Brings each Claude Code chat back after a reboot or crash. | Linux or WSL |
| [`shutdown`](#shutdown) | Shuts WSL down 2 minutes after you close Herdr. | Windows + WSL |

Built and checked on herdr-app 0.1.16 and herdr-core 0.1.21.

## Installing a Herdr mod

The three mods in `mods/` install the same way:

1. Copy the mod's folder into Herdr's `mods` folder: `~/.config/herdr-app/mods/` (on Windows, `%USERPROFILE%\.config\herdr-app\mods\`).
   Copy the folder, don't symlink it: Herdr doesn't see changes inside a symlinked folder.
2. Check it: `herdr-app check ~/.config/herdr-app/mods/<name>`.
3. Make your own layout to put it in. Don't edit Herdr's `main` layout in place, Herdr restores it on updates:
   `herdr-app do layout.clone --name main --as my-layout`, then `herdr-app do layout.switch --name my-layout`.
4. Edit `~/.config/herdr-app/layouts/my-layout.json` as each mod says below. Herdr redraws as soon as you save.

Or ask the agent in your Herdr window to install it from this repo's link.

## agents-status

Agents grouped by status, with the ones that need you on top. A finished or stuck agent gets a tint and a word (**Done**,
**Blocked**), a working one a spinner, idle ones stay quiet. The agent you're on gets an accent outline.

In your layout, find the block with `"mod": "agents"` and change it to `"mod": "agents-status"`.

To jump to the top agent under **Needs you** with F8, add to the `"global"` section of `~/.config/herdr-app/keys.json`:

```json
"f8": "agents-status.needs"
```

It leaves out what Herdr's own list has beyond that: pins, sub-agents nested under their parent, and the sort menu.

## release-status

For the space you're in: how many merges the dev branch has that `main` doesn't, with their titles, or **All released**.
The dev branch is the first of `develop`, `dev` or `development` the repo has.
Merges of `main` back into it don't count. A red line says when `main` has commits it lacks.
Repos without any of the three say so. Branches other than yours are read from `origin`, so it's as fresh as your last fetch.

## dev-apps

For the space you're in: each browser app, running or stopped, its `localhost` link (click to open it in your browser),
the project's containers, and Start and Stop.

It reads which apps a project has from a small registry file, `~/.config/dev-ports/registry.tsv` on the space's machine
(or the path in `$DEV_PORTS_REGISTRY`). One line per port, tab-separated:

```
# port	project	service
6004	shadowboard	web
5432	shadowboard	postgres
```

`project` is the repo's folder name. Only `web`, `backoffice`, `admin`, and services starting with `storybook` or `docs`
show; databases and APIs stay hidden.

- **Start** runs `docker compose watch` when the compose file has a `develop: watch:` section, else `docker compose up -d`.
  Without a compose file that maps the app's port, it runs the `package.json` script that names the port, with the package
  manager picked from the lock file.
- **Stop** runs `docker compose down`, database included, or stops the scripts it started.
- Logs go to `~/.cache/dev-apps/<project>/`.

### Putting release-status and dev-apps in a column

Add this to your layout's row that holds the `"main"` block, right after it, for a column on the right:
release on top, apps below.

```json
{
  "id": "project", "type": "column", "size": { "px": 320 }, "min": 240, "max": 600, "background": "chrome",
  "children": [
    { "id": "release", "type": "block", "size": { "weight": 1 }, "content": { "mod": "release-status" } },
    { "id": "apps", "type": "block", "size": { "weight": 1 }, "content": { "mod": "dev-apps" } }
  ]
}
```

## blocked-run

When auto mode blocks a Bash command, or Claude ends a reply with `! <command>` for you to run, the command shows in a
**Commands** box for the space you're in. **Run it** types `! <command>` into that Claude: Claude runs it as your own
command, sees the output and answers. If Claude is busy, it runs when the turn ends. **Dismiss** drops it.

When Claude replies again, the asks you didn't run are dropped; blocked commands stay until you run or dismiss them.

Two parts, with `<repo>` the path of this clone:

1. A Claude Code hook that writes the waiting commands to `~/.config/herdr-blocked/<terminal>.json`. Add to
   `~/.claude/settings.json`, next to any hooks you have:

   ```json
   "PermissionDenied": [{ "hooks": [{ "type": "command", "command": "python3 -I '<repo>/blocked/hook.py'", "timeout": 10 }] }],
   "Stop": [{ "hooks": [{ "type": "command", "command": "python3 -I '<repo>/blocked/hook.py'", "timeout": 10 }] }]
   ```

2. The `blocked-run` mod. Install it like the others and add a block for it, for example under `apps` in the column below:
   `{ "id": "commands", "type": "block", "size": { "weight": 1 }, "content": { "mod": "blocked-run" } }`

## resume

The Herdr app brings terminals back after a reboot or a crash, but as plain shells. This brings each Claude Code chat
back in its terminal by itself.

- A Claude Code hook saves each terminal's session id to `~/.config/herdr-resume/<terminal>.json`, and deletes it when
  Claude exits cleanly. It also drops records of terminals that are gone.
- A line in `~/.bashrc` types `claude --resume <id>` into a terminal's first shell when it has a record.

Needs Python 3 (standard library only) and bash. Install, with `<repo>` the path of this clone:

1. Add the hook to `~/.claude/settings.json`, next to any hooks you have:

   ```json
   "hooks": {
     "SessionStart": [{ "hooks": [{ "type": "command", "command": "python3 -I '<repo>/resume/hook.py'", "timeout": 10 }] }],
     "SessionEnd": [{ "hooks": [{ "type": "command", "command": "python3 -I '<repo>/resume/hook.py'", "timeout": 10 }] }]
   }
   ```

2. Add to the end of `~/.bashrc`: `source <repo>/resume/on-shell-start.sh`

New Claude sessions are saved from then on.

## shutdown

Closing Herdr leaves WSL running: herdr-core keeps your terminals alive, along with Docker and everything else. This
watcher checks once a minute whether `herdr-app.exe` runs. Once it's been closed for 2 checks in a row, it stops Herdr's
Windows core (which would start WSL again within seconds) and runs `wsl --shutdown`.

**It stops everything in WSL**, Docker and running agents included. With `resume` installed, your chats come back
when you open Herdr. If you use WSL without Herdr open, WSL shuts down after 2 minutes.

Needs systemd in WSL. Install, from this clone:

```sh
mkdir -p ~/.config/systemd/user
sed "s#%h/projects/personal/herdr-mods#$PWD#" shutdown/herdr-watch.service > ~/.config/systemd/user/herdr-watch.service
systemctl --user daemon-reload
systemctl --user enable --now herdr-watch.service
loginctl enable-linger "$USER"
```

To turn it off: `systemctl --user disable --now herdr-watch.service`.

## Tests

```sh
node --test mods/*/*.test.js
python3 -m unittest discover -s resume
python3 -m unittest discover -s shutdown
python3 -m unittest discover -s blocked
```

`dev-apps` and `release-status` are ported from the `dev-apps` and `branch-status` mods in
[claude-mods](https://github.com/Spardutti/claude-mods), tests included.

## License

MIT
