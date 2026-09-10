#!/bin/bash
#
# Install (or remove) the LaunchAgent that starts the render worker at login.
#
#   ./worker/install-launchd.sh install
#   ./worker/install-launchd.sh status
#   ./worker/install-launchd.sh uninstall
#
# ── What gets written ──
#
# One plist at ~/Library/LaunchAgents/studio.pressmark.worker.plist, containing
# only paths — the repository location and where to write logs. No token, no
# API URL, no configuration of any kind. Everything sensitive stays in
# .env.local, which start-worker.sh loads at launch.
#
# ── A LaunchAgent, not a LaunchDaemon ──
#
# Deliberate. InDesign needs a logged-in GUI session; a daemon starting at boot
# would have no window server to talk to and every render would fail. This
# starts at LOGIN, which means the Mac must be logged in for renders to happen.

set -euo pipefail

LABEL="studio.pressmark.worker"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
LOG_DIR="$HOME/Library/Logs"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
STARTER="$REPO_ROOT/worker/start-worker.sh"

action="${1:-}"

case "$action" in
  install)
    [ -x "$STARTER" ] || chmod +x "$STARTER"
    mkdir -p "$HOME/Library/LaunchAgents" "$LOG_DIR"

    # Unload an existing agent first so install is repeatable.
    launchctl unload "$PLIST" 2>/dev/null || true

    cat > "$PLIST" <<PLISTEOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>$LABEL</string>

  <!-- Paths only. No token, no API URL: start-worker.sh reads .env.local. -->
  <key>ProgramArguments</key>
  <array>
    <string>$STARTER</string>
  </array>

  <key>WorkingDirectory</key>
  <string>$REPO_ROOT</string>

  <key>RunAtLoad</key>
  <true/>

  <!-- Restart if the worker exits unexpectedly. start-worker.sh exits 78 on a
       configuration problem, and launchd will not respawn that. -->
  <key>KeepAlive</key>
  <dict>
    <key>SuccessfulExit</key>
    <false/>
  </dict>

  <!-- Give a crashed worker room to breathe rather than hot-looping. -->
  <key>ThrottleInterval</key>
  <integer>30</integer>

  <!-- One worker, one InDesign, one job at a time. -->
  <key>LimitLoadToSessionType</key>
  <string>Aqua</string>

  <key>StandardOutPath</key>
  <string>$LOG_DIR/pressmark-worker.log</string>
  <key>StandardErrorPath</key>
  <string>$LOG_DIR/pressmark-worker.error.log</string>
</dict>
</plist>
PLISTEOF

    chmod 600 "$PLIST"
    launchctl load "$PLIST"

    echo "Installed $LABEL"
    echo "  plist : $PLIST  (contains no secrets)"
    echo "  logs  : $LOG_DIR/pressmark-worker.log"
    echo "          $LOG_DIR/pressmark-worker.error.log"
    echo ""
    echo "The worker is now running and will start again at each login."
    echo "Check it with:  ./worker/install-launchd.sh status"
    ;;

  uninstall)
    launchctl unload "$PLIST" 2>/dev/null || true
    rm -f "$PLIST"
    echo "Removed $LABEL. The worker is stopped and will not start at login."
    ;;

  status)
    # `launchctl print` is authoritative and, unlike `launchctl list | grep -q`,
    # survives `set -o pipefail`: grep -q exits at the first match, launchctl
    # takes SIGPIPE, and the pipeline reports failure — which made this print
    # "not loaded" for an agent that was demonstrably running.
    if info="$(launchctl print "gui/$(id -u)/$LABEL" 2>/dev/null)"; then
      state="$(printf '%s\n' "$info" | awk -F'= ' '/^\tstate = /{print $2; exit}')"
      pid="$(printf '%s\n' "$info" | awk -F'= ' '/^\tpid = /{print $2; exit}')"
      echo "LaunchAgent : loaded (${state:-unknown})${pid:+  pid=$pid}"
    else
      echo "LaunchAgent : not loaded"
    fi
    echo "plist       : $([ -f "$PLIST" ] && echo "$PLIST" || echo "not installed")"
    if pgrep -f "worker/pressmark-worker.mjs" >/dev/null 2>&1; then
      echo "process     : running"
    else
      echo "process     : not running"
    fi
    echo ""
    echo "Last 15 log lines:"
    tail -n 15 "$LOG_DIR/pressmark-worker.log" 2>/dev/null | sed 's/^/  /' || echo "  (no log yet)"
    ;;

  *)
    echo "usage: $0 {install|uninstall|status}" >&2
    exit 64
    ;;
esac
