#!/bin/bash
# This is a student test

T_FOLDER=${T_FOLDER:-t}
R_FOLDER=${R_FOLDER:-}

cd "$(dirname "$0")/../..$R_FOLDER" || exit 1

DIFF=${DIFF:-diff}
DIFF_PERCENT=${DIFF_PERCENT:-0}


cat "$T_FOLDER"/d/s_merge_global.txt > d/global-index.txt
c/merge.js d/global-index.txt <"$T_FOLDER"/d/s_merge_local.txt > d/temp-global-index.txt
mv d/temp-global-index.txt d/global-index.txt

if DIFF_PERCENT=$DIFF_PERCENT t/gi-diff.js <(sort d/global-index.txt) <(sort "$T_FOLDER"/d/s_merge_result.txt) >&2;
then
    echo "$0 success: global indexes are identical"
    cat /dev/null > d/global-index.txt
    exit 0
else
    echo "$0 failure: global indexes are not identical"
    cat /dev/null > d/global-index.txt
    exit 1
fi
