#!/bin/bash
# Start virtual display (Xvfb) so Chromium can run in headed mode on the server
Xvfb :99 -screen 0 1280x800x24 -ac &
XVFB_PID=$!

# Give Xvfb a moment to start
sleep 1

echo "[start] Virtual display started on :99"

# Start the worker — capture its exit code so Fly sees non-zero on watchdog kills
# (without this, the script exits with the result of 'kill' below — usually 0 —
# so Fly treats every exit as a clean shutdown and does NOT restart the machine)
node dist/index.js
NODE_EXIT=$?

# Clean up Xvfb on exit
kill $XVFB_PID 2>/dev/null

# Propagate node's exit code so Fly restarts on process.exit(1)
exit $NODE_EXIT
