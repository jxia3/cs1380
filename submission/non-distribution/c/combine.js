#!/usr/bin/env node

/*
Combine terms to create n-grams (for n=1,2,3)
Usage: ./combine.js <terms > n-grams
*/

const readline = require("readline");

const NGRAM_SIZES = [1, 2, 3];

const rl = readline.createInterface({
  input: process.stdin,
});
const terms = [];

rl.on("line", (line) => {
  const term = line.trim();
  if (term !== "") {
    terms.push(term);
  }
});

rl.on("close", () => {
  const ngrams = [];
  for (const size of NGRAM_SIZES) {
    for (let t = 0; t < terms.length - size + 1; t += 1) {
      const ngram = [];
      for (let p = 0; p < size; p += 1) {
        ngram.push(terms[t + p]);
      }
      ngrams.push(ngram.join("\t"));
    }
  }

  ngrams.sort();
  for (const ngram of ngrams) {
    console.log(ngram);
  }
});
