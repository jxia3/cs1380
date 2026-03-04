#!/bin/bash
# Kill node processes using the distribution test ports.
# Run before t.js or t6.js to avoid EADDRINUSE errors.
#
# Usage: ./scripts/kill-ports.sh

PORTS="1234 2000 2001 2002"
KILLED=0

for port in $PORTS; do
  pid=$(lsof -ti :$port 2>/dev/null)
  if [ -n "$pid" ]; then
    kill -9 $pid 2>/dev/null
    echo "Killed process $pid on port $port"
    KILLED=$((KILLED + 1))
  fi
done

if [ $KILLED -eq 0 ]; then
  echo "No processes found on ports $PORTS"
else
  echo "Freed $KILLED port(s)"
fi
