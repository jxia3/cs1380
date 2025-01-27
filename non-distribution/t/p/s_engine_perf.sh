#!/bin/bash
# The script times the crawler and indexer to measure performance

ENABLE_TFIDF=false

cd "$(dirname "$0")/../.." || exit 1

echo "https://cs.brown.edu/courses/csci1380/sandbox/1" > d/urls.txt
cat /dev/null > d/visited.txt

crawl_time=0
index_time=0

while read -r url; do

  if [[ "$url" == "stop" ]]; then
    # stop the engine if it sees the string "stop" 
    break;
  fi

  crawl_start=$(date +%s.%N)
  echo "[engine] crawling $url">/dev/stderr
  ./crawl.sh "$url" >d/content.txt
  crawl_end=$(date +%s.%N)
  crawl_time=$(node -e "console.log($crawl_time + $crawl_end - $crawl_start)")

  index_start=$(date +%s.%N)
  echo "[engine] indexing $url">/dev/stderr
  if $ENABLE_TFIDF; then
    ./index-tfidf.js d/content.txt "$url"
  else
    ./index.sh d/content.txt "$url"
  fi
  index_end=$(date +%s.%N)
  index_time=$(node -e "console.log($index_time + $index_end - $index_start)")

  if  [[ "$(cat d/visited.txt | wc -l)" -ge "$(cat d/urls.txt | wc -l)" ]]; then
      # stop the engine if it has seen all available URLs
      break;
  fi

done < <(tail -f d/urls.txt)

echo ""
echo "crawl time: $crawl_time"
echo "index time: $index_time"
wc -l d/visited.txt

echo "https://cs.brown.edu/courses/csci1380/sandbox/1" > d/urls.txt
cat /dev/null > d/visited.txt
cat /dev/null > d/content.txt