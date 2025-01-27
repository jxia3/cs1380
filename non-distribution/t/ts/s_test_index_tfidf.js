#!/usr/bin/env node

/* Generates synthetic documents and runs the TF-IDF indexer on the documents to test
   TF-IDF correctness. The documents are generated in the following format:
   - The first document repeats the same word 50 times.
   - The second and third documents repeat 2 words 50 times each.
   - The fourth document contains 50 unique words.
   The TF-IDF scores for each term and document can then be computed and validated. */

// Generate words for the documents
const SINGLE_REPEAT = 'lorem';
const DOUBLE_REPEAT = ['ipsum', 'dolor'];
const UNIQUE_WORDS = [];
for (let w = 0; w < 50; w += 1) {
  const first = Math.floor(w / 26);
  const second = w % 26;
  const startCode = 'a'.charCodeAt(0);
  UNIQUE_WORDS.push(String.fromCharCode(startCode + first, startCode + second));
}
console.log(UNIQUE_WORDS);

/* Generates a document with a single word repeated 50 times. */
function generateSingleRepeat() {
  const doc = [];
  for (let w = 0; w < 50; w += 1) {
    doc.push(SINGLE_REPEAT);
  }
  return doc.join(' ');
}

/* Generates a document with two words repeated 50 times each. */
function generateDoubleRepeat() {
  const doc = [];
  for (let w = 0; w < 100; w += 1) {
    doc.push(DOUBLE_REPEAT[w % 2]);
  }
  return doc.join(' ');
}

/* Generates a document with 50 unique words. */
function generateUnique() {
  return UNIQUE_WORDS.join(' ');
}
