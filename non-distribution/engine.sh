#!/bin/bash
# This is the main entry point of the search engine.

ENABLE_TFIDF=true

cd "$(dirname "$0")" || exit 1

while read -r url; do

  if [[ "$url" == "stop" ]]; then
    # stop the engine if it sees the string "stop" 
    break;
  fi

  echo "[engine] crawling $url">/dev/stderr
  ./crawl.sh "$url" >d/content.txt
  echo "[engine] indexing $url">/dev/stderr
  if $ENABLE_TFIDF; then
    ./index-tfidf.js d/content.txt "$url"
  else
    ./index.sh d/content.txt "$url"
  fi

  if  [[ "$(cat d/visited.txt | wc -l)" -ge "$(cat d/urls.txt | wc -l)" ]]; then
      # stop the engine if it has seen all available URLs
      break;
  fi

done < <(tail -f d/urls.txt)
