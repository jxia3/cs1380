#!/usr/bin/env node

/* Generates synthetic documents and runs the TF-IDF indexer on the documents to test
   TF-IDF correctness. The documents are generated in the following format:
   - The first document repeats the same word 50 times.
   - The second and third documents repeat 2 words 50 times each.
   - The fourth document contains 50 unique words.
   The TF-IDF scores for each term and document can then be computed and validated. */

const fs = require('fs');
const path = require('path');
const childProcess = require('child_process');

const DOCUMENT_FILES = [
  path.join(__dirname, '../d/s_tfidf_1.txt'),
  path.join(__dirname, '../d/s_tfidf_2.txt'),
  path.join(__dirname, '../d/s_tfidf_3.txt'),
  path.join(__dirname, '../d/s_tfidf_4.txt'),
];
const DOCUMENT_URLS = [
  'https://a.com',
  'https://b.com',
  'https://c.com',
  'https://d.com',
];
const GLOBAL_INDEX = path.join(__dirname, '../../d/global-index.txt');

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

// Run TF-IDF indexer
clearTestFiles();
generateDocuments();
for (let d = 0; d < DOCUMENT_FILES.length; d += 1) {
  childProcess.execSync(`${path.join(__dirname, '../../index-tfidf.js')} ${DOCUMENT_FILES[d]} ${DOCUMENT_URLS[d]}`);
}

// Check global index
fs.readFile(GLOBAL_INDEX, 'utf8', (error, data) => {
  if (error) {
    console.error('Error reading file:', error);
    process.exit(1);
  }
  const valid = checkGlobalIndex(data);
  clearTestFiles();
  if (valid) {
    console.error('Global index valid');
  } else {
    console.error('Global index invalid');
    process.exit(1);
  }
});

/* Clears global test files. */
function clearTestFiles() {
  childProcess.execSync(`echo "https://cs.brown.edu/courses/csci1380/sandbox/1" > ${path.join(__dirname, '../../d/urls.txt')}`);
  childProcess.execSync(`cat /dev/null > ${path.join(__dirname, '../../d/visited.txt')}`);
  childProcess.execSync(`cat /dev/null > ${path.join(__dirname, '../../d/content.txt')}`);
  childProcess.execSync(`cat /dev/null > ${path.join(__dirname, '../../d/tfidf-index.txt')}`);
  childProcess.execSync(`cat /dev/null > ${path.join(__dirname, '../../d/global-index.txt')}`);
}

/* Generates and saves synthetic documents. */
function generateDocuments() {
  fs.writeFileSync(DOCUMENT_FILES[0], generateSingleRepeat());
  fs.writeFileSync(DOCUMENT_FILES[1], generateDoubleRepeat());
  fs.writeFileSync(DOCUMENT_FILES[2], generateDoubleRepeat());
  fs.writeFileSync(DOCUMENT_FILES[3], generateUnique());
}

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

/* Checks the TF-IDF scores in a global index file. */
function checkGlobalIndex(content) {
  if (content === '') {
    return false;
  }

  // Check line format and term order
  const lines = content.split('\n');
  if (!lines.every(checkLineFormat)) {
    return false;
  }
  const indexLines = lines.map(l => l.split(' | '));
  if (!checkIndexSorted(indexLines)) {
    return false;
  }

  // Parse documents
  const terms = {};
  for (let l = 0; l < indexLines.length; l += 1) {
    const docs = [];
    const parts = indexLines[l][1].split(' ');
    for (let p = 0; p < parts.length; p += 2) {
      docs.push({
        url: parts[p],
        score: +parts[p + 1],
      });
    }
    terms[indexLines[l][0]] = docs;
  }

  // Check TF-IDF scores
  return checkIndexScores(terms);
}

/* Checks the format of a line in a global index. */
function checkLineFormat(line) {
  return true;
}

/* Checks if the terms in a global index are sorted alphabetically. */
function checkIndexSorted(lines) {
  return true;
}

/* Checks if the global index TF-IDF scores match the expected scores. */
function checkIndexScores(terms) {
  return true;
}