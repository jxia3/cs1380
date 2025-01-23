#!/bin/bash

# Convert input to a stream of non-stopword terms
# Usage: ./process.sh < input > output

# Convert each line to one word per line, **remove non-letter characters**, make lowercase, convert to ASCII; then remove stopwords (inside d/stopwords.txt)
# Commands that will be useful: tr, iconv, grep

cd "$(dirname "$0")/.." || exit 1

tr -s "[:space:]" "\n" \
    | tr -dcs "[:alpha:]\n" "\n" \
    | tr "[:upper:]" "[:lower:]" \
    | iconv -t "ASCII//TRANSLIT" \
    | grep -vxFf "d/stopwords.txt"