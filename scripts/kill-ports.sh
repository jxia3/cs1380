#!/bin/bash
# Kill node processes using the distribution test ports.
# Run before t.js or t6.js to avoid EADDRINUSE errors.
#
# Usage: ./scripts/kill-ports.sh

# Main node (1234), t6/p6 workers (2000–2002), Jest/mr/m6 and other suite ports
PORTS="1234 2000 2001 2002 2345 7110 7111 7112 7200 7201 7202 7203 8000 8001 8002 8003 8004 8005 8006 8007 8008 9001 9002 9003 9004 9005 9006 9090"
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
