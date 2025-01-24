#!/usr/bin/env node

/*
Invert index to create a mapping from a term to all URLs containing the term.
Usage: ./invert.js url < n-grams
*/

const readline = require('readline');
const {URL} = require('url');

if (process.argv.length < 3) {
  console.error('expected url');
  process.exit(1);
}
const pageURL = process.argv[2];

const rl = readline.createInterface({
  input: process.stdin,
});
const terms = [];

rl.on('line', (line) => {
  const term = line.trim();
  if (term !== '') {
    terms.push(line.trim());
  }
});

rl.on('close', () => {
  const ngrams = [];
  for (const size of NGRAM_SIZES) {
    for (let t = 0; t < terms.length - size + 1; t += 1) {
      const ngram = [];
      for (let p = 0; p < size; p += 1) {
        ngram.push(terms[t + p]);
      }
      ngrams.push(ngram.join(' '));
    }
  }

  ngrams.sort();
  for (const ngram of ngrams) {
    console.log(ngram);
  }
});
