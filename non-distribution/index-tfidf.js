#!/usr/bin/env node

/* An implementation of a TF-IDF indexer. Term frequency and document frequency metrics
   are tracked in an auxiliary global index file. */

const fs = require('fs');
const natural = require('natural');
const path = require('path');

const STOPWORD_FILE = path.join(__dirname, 'd/stopwords.txt');
const TFIDF_INDEX = path.join(__dirname, 'd/tfidf-index.txt');
const GLOBAL_INDEX = path.join(__dirname, 'd/global-index.txt');
const NGRAM_SIZES = [1, 2, 3];

// Parse command line arguments
if (process.argv.length < 4) {
  console.error('Expected content file and page URL');
  process.exit(1);
}
const contentFile = process.argv[2];
const pageURL = process.argv[3];

// Start index pipeline
readFile(STOPWORD_FILE, (stopwordData) => {
  readFile(contentFile, (contentData) => {
    const stopwords = stopwordData.trim().split('\n');
    processContent(stopwords, contentData, pageURL);
  });
});

/* Extracts terms from page content and updates the TF-IDF index. */
function processContent(stopwords, pageContent, pageURL) {
  // Process step: convert page content into words and remove stopwords
  const words = pageContent
      .replaceAll(/[^a-zA-Z\n]/g, '\n')
      .replaceAll(/\s+/g, '\n')
      .trim()
      .toLowerCase()
      .split('\n');

  // Stem step: convert words to Porter stems
  const stemmed = words.map(natural.PorterStemmer.stem);

  // Combine step: combine words into ngram terms
  const terms = [];
  for (const size of NGRAM_SIZES) {
    for (let w = 0; w < stemmed.length - size + 1; w += 1) {
      const term = [];
      for (let p = 0; p < size; p += 1) {
        term.push(stemmed[w + p]);
      }
      terms.push(term.join(' '));
    }
  }

  // Invert step: compute term frequencies
  const termCounts = {};
  for (const term of terms) {
    if (term in termCounts) {
      termCounts[term] += 1;
    } else {
      termCounts[term] = 1;
    }
  }

  // Merge document with global indices
  readFile(TFIDF_INDEX, tfidfData => {
    readFile(GLOBAL_INDEX, globalData => {
      mergeDocument(tfidfData, globalData, termCounts, pageURL);
    });
  });
}

/* Merges a document with the TF-IDF and global indices. */
function mergeDocument(tfidfIndex, globalIndex, termCounts, pageURL) {
  console.log("tfidf:", tfidfIndex);
  console.log("global:", globalIndex);
  console.log("url:", pageURL);
}

/* Reads text content from a file and exits on an error */
function readFile(path, callback) {
  fs.readFile(path, 'utf8', (error, data) => {
    if (error) {
      console.error('Error reading file:', error);
      process.exit(1);
    }
    callback(data);
  });
}
