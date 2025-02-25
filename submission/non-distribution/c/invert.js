#!/usr/bin/env node

/*
Invert index to create a mapping from a term to all URLs containing the term.
Usage: ./invert.js url < n-grams
*/

const readline = require("readline");

let pageURL = "";
if (process.argv.length >= 3) {
  pageURL = process.argv[2];
}

const rl = readline.createInterface({
  input: process.stdin,
});
const terms = [];

rl.on("line", (line) => {
  const term = line.trim().split(/\s+/).join(" ");
  if (term !== "") {
    terms.push(term);
  }
});

rl.on("close", () => {
  const counts = {};
  for (const term of terms) {
    if (term in counts) {
      counts[term] += 1;
    } else {
      counts[term] = 1;
    }
  }

  const sortedTerms = Object.keys(counts);
  sortedTerms.sort();
  for (const term of sortedTerms) {
    console.log(`${term} | ${counts[term]} | ${pageURL}`);
  }
});
