#!/bin/bash
#
# Launch the Pressmark render worker.
#
# This is what launchd runs, and it is also a perfectly good way to start the
# worker by hand. Its whole job is to resolve paths and load the environment
# files, so that neither launchd nor this script ever contains a secret.
#
# ── Why the token is not in the plist ──
#
# The obvious launchd setup puts PRESSMARK_WORKER_TOKEN in the plist's
# EnvironmentVariables dictionary. That writes the token into a file in
# ~/Library/LaunchAgents, where it is world-readable by default, survives in
# Time Machine backups, and is easy to paste into a support thread by accident.
#
# Instead the plist runs this script with no environment at all, and the token
# is read from .env.local at launch — one copy on the machine, in a file that is
# already gitignored and already the place secrets live.
#
# ── Exit codes ──
#
# Non-zero on a configuration problem so launchd's KeepAlive does not spin
# restarting a worker that cannot possibly work. The reason is printed first.

set -euo pipefail

# Resolve the repository root from this script's own location, so the worker
# runs correctly no matter what directory launchd starts it in.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

# launchd gives a process a minimal PATH that usually excludes Homebrew and nvm,
# so `node` must be found explicitly rather than assumed.
find_node() {
  if [ -n "${NODE_BIN:-}" ] && [ -x "${NODE_BIN}" ]; then
    echo "${NODE_BIN}"
    return 0
  fi
  for candidate in \
    /opt/homebrew/bin/node \
    /usr/local/bin/node \
    /usr/bin/node \
    "$HOME/.nvm/versions/node/*/bin/node"
  do
    # shellcheck disable=SC2086
    for resolved in $candidate; do
      [ -x "$resolved" ] && { echo "$resolved"; return 0; }
    done
  done
  command -v node 2>/dev/null && return 0
  return 1
}

NODE="$(find_node)" || {
  echo "pressmark-worker: could not find node. Set NODE_BIN to its absolute path." >&2
  exit 78  # EX_CONFIG
}

for required in .env.worker .env.local; do
  if [ ! -f "$REPO_ROOT/$required" ]; then
    echo "pressmark-worker: missing $required in $REPO_ROOT" >&2
    exit 78
  fi
done

# .env.worker carries paths and the API URL; .env.local carries the token.
# .env.local goes LAST so its values win.
exec "$NODE" \
  --env-file="$REPO_ROOT/.env.worker" \
  --env-file="$REPO_ROOT/.env.local" \
  "$REPO_ROOT/worker/pressmark-worker.mjs"
