---
name: todos
description: Read and write the user's todo lists, the ones shown in Herdr's Todos window. Use when the user mentions a todo, "add this to my list", "what's left", or asks what to work on next.
---

# Todos

Each list is a folder in `~/.config/todos/`, one JSON file per todo. Always go through the script. Never edit the files by hand.

```
node ~/.claude/skills/todos/todos.mjs <command>
```

| Command | Does |
|---|---|
| `lists` | Every list with its pending count. |
| `create "name"` | Makes an empty list. The name becomes lowercase with dashes. |
| `list <list>` | Pending todos, newest first: `#n`, the id, then the first line of the text. |
| `add <list> "text"` | Adds a todo. Prints its id. |
| `edit <list> <id> "text"` | Replaces a todo's text. |
| `done <list> <id>` | Marks a todo done. |
| `delete <list> <id>` | Removes a todo for good. Only when the user asks to delete. |

An `<id>` can be its first few characters, as long as only one todo starts with them.

The `#n` matches the number in the Todos window. When the user says "#2", run `list` and use that todo's id.

## Pick the list

1. Get the project name: run `git rev-parse --path-format=absolute --git-common-dir`, drop a trailing `/.git`, and take the last folder. A worktree then shares its main repo's list. Outside git, use the current folder's name.
2. Make it lowercase, with dashes for anything but letters and digits. That is the list name.
3. Run `lists`. If the name is there, use it.
4. If not, offer to `create` it. Don't create it without asking.

The Todos window shows changes within 3 seconds.
