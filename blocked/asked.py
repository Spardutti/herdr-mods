import re

OWN_LINE = re.compile(r"^\s*!\s+(\S[\s\S]*?)\s*$")
FENCE = re.compile(r"^\s*```")


def _chunks(reply):
    chunks = [(False, [])]
    for line in reply.split("\n"):
        fenced, lines = chunks[-1]
        if FENCE.match(line):
            chunks.append((not fenced, []))
        else:
            lines.append(line)
    return chunks


def _join_continued(lines):
    joined = []
    for line in lines:
        if joined and joined[-1].rstrip().endswith("\\"):
            joined[-1] = f"{joined[-1]}\n{line}"
        else:
            joined.append(line)
    return joined


# Only an ask on its own line counts: one mentioned inside a sentence is Claude talking about a command.
# A fenced block counts only when every line in it is an ask, so a script's `! grep` stays out.
def _in_chunk(fenced, lines):
    joined = [line for line in _join_continued(lines) if line.strip()]
    own = [OWN_LINE.match(line) for line in joined]
    if not fenced:
        return [m.group(1) for m in own if m]
    return [m.group(1) for m in own] if all(own) else []


def asked_commands(reply):
    """The `! command` asks in Claude's reply, in order: on their own line, or an all-ask fenced block."""
    return [command for fenced, lines in _chunks(reply) for command in _in_chunk(fenced, lines)]
