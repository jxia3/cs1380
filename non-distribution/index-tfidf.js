#!/usr/bin/env node

/* An implementation of a TF-IDF indexer. Term frequency and document frequency metrics
   are tracked in an auxiliary global index file. */

const fs = require('fs');
const natural = require('natural');
const path = require('path');

const STOPWORD_FILE = path.join(__dirname, 'd/stopwords.txt');
const TFIDF_INDEX = path.join(__dirname, 'd/tfidf-index.txt');
const GLOBAL_INDEX = path.join(__dirname, 'd/global-index.txt');

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
  console.log(stopwords);
  console.log(pageContent);
  console.log(pageURL);
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
