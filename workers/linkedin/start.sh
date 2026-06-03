#!/bin/bash
# Start virtual display (Xvfb) so Chromium can run in headed mode on the server
Xvfb :99 -screen 0 1280x800x24 -ac &
XVFB_PID=$!

# Give Xvfb a moment to start
sleep 1

echo "[start] Virtual display started on :99"

# Start the worker
node dist/index.js

# Clean up Xvfb on exit
kill $XVFB_PID 2>/dev/null
