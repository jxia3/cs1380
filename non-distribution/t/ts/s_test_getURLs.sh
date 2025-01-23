#!/bin/bash
# This is a student test

T_FOLDER=${T_FOLDER:-t}
R_FOLDER=${R_FOLDER:-}

cd "$(dirname "$0")/../..$R_FOLDER" || exit 1

DIFF=${DIFF:-diff}

url="https://example.com"


if $DIFF <(cat "$T_FOLDER"/d/s_getURLs_html.txt | c/getURLs.js $url | sort) <(sort "$T_FOLDER"/d/s_getURLs_urls.txt) >&2;
then
    echo "$0 success: URL sets are identical"
    exit 0
else
    echo "$0 failure: URL sets are not identical"
    exit 1
fi