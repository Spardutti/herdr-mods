herdr_resume() {
  local session folder command
  { IFS= read -r session && IFS= read -r folder; } < <(python3 -I "${BASH_SOURCE[0]%/*}/hook.py" take) || return 0
  [ -d "$folder" ] || return 0
  printf -v command 'cd -- %q && claude --resume %q' "$folder" "$session"
  # Typed in, not run here: during .bashrc Claude would share bash's process group and Herdr would show bash.
  (hc send "$HC_TERMINAL_ID" "$command" >/dev/null 2>&1 &)
}

# SHLVL 1: only the terminal's own shell, not a bash started inside it.
if [ -n "${HC_TERMINAL_ID:-}" ] && [ "$SHLVL" = 1 ]; then
  herdr_resume
fi
unset -f herdr_resume
