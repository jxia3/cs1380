#!/bin/bash
# Run a test script with port cleanup and timeout to avoid hangs.
#
# Usage: ./scripts/run-test.sh [script]
#   script: path to test script (default: t6.js)
#
# Example: ./scripts/run-test.sh t6.js
#          ./scripts/run-test.sh t.js

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
TEST_SCRIPT="${1:-t6.js}"
TIMEOUT_SEC=45

cd "$ROOT_DIR"

echo "Killing processes on test ports..."
"$SCRIPT_DIR/kill-ports.sh"
sleep 2

echo "Running $TEST_SCRIPT (timeout: ${TIMEOUT_SEC}s)..."
timeout "$TIMEOUT_SEC" node "$TEST_SCRIPT" 2>&1
EXIT=$?

if [ $EXIT -eq 124 ]; then
  echo "Test timed out after ${TIMEOUT_SEC}s"
fi

echo "Cleaning up ports..."
"$SCRIPT_DIR/kill-ports.sh"

exit $EXIT
