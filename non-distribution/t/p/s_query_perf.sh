#!/bin/bash
# The script times the query handler to measure performance

cd "$(dirname "$0")/../.." || exit 1

terms=(
  "action"
  "biology"
  "challenge qubit"
  "deep sea"
  "element"
  "field quantum computing"
  "grow"
  "hold item"
  "intersect art"
  "journey trans siberian"
  "kilometer"
  "lake"
  "marvel unique"
  "night"
  "ocean depth"
  "particle separation distance"
  "quantum bit"
  "railway"
  "sea"
  "the"
  "understood captive subject"
  "van gogh"
  "west russia"
  "xylophone"
  "yellow river"
  "zone"
)

query_start=`date +%s.%N`
for term in "${terms[@]}"; do
  echo "querying $term"
  ./query.js "$term" >/dev/null
done
query_end=`date +%s.%N`
query_time=`node -e "console.log($query_end - $query_start)"`

echo ""
echo "query time: $query_time"
echo "${#terms[@]}"