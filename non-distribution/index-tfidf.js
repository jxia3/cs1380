#!/usr/bin/env node

/* An implementation of a TF-IDF indexer. Term frequency and document frequency metrics
   are tracked in an auxiliary global index file. A global index is created from the
   auxiliary index. The script provides two functions: createGlobalIndexTFIDF and
   createGlobalIndexBasic. The TF-IDF version ranks pages by the TF-IDF rank. The basic
   version ranks pages by term frequency and passes the basic tests. */

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
const pageUrl = process.argv[3];

// Start index pipeline
readFile(STOPWORD_FILE, (stopwordData) => {
  readFile(contentFile, (contentData) => {
    const stopwords = stopwordData.trim().split('\n');
    processContent(stopwords, contentData, pageUrl);
  });
});

/* Extracts terms from page content and updates the TF-IDF index. */
function processContent(stopwords, pageContent, pageUrl) {
  // Process step: convert page content into words and remove stopwords
  const words = pageContent
      .replaceAll(/[^a-zA-Z\n]/g, '\n')
      .replaceAll(/\s+/g, '\n')
      .trim()
      .toLowerCase()
      .split('\n')
      .filter((w) => !stopwords.includes(w));

  // Stem step: convert words to Porter stems
  const stemmed = words.map(natural.PorterStemmer.stem);
  const docLen = stemmed.length;

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
  readFile(TFIDF_INDEX, (indexData) => {
    const [numDocs, termIndex] = parseIndex(indexData);
    mergeDocument(numDocs, termIndex, docLen, termCounts, pageUrl);
  });
}

/* Merges a document with the TF-IDF and global indices. */
function mergeDocument(numDocs, termIndex, docLen, termCounts, pageUrl) {
  // Increment document counts
  numDocs += 1;
  for (const term in termIndex) {
    if (term in termCounts) {
      termIndex[term].docCount += 1;
    }
  }

  // Add new terms
  for (const term in termCounts) {
    if (!(term in termIndex)) {
      termIndex[term] = {
        docCount: 1,
        docs: {},
      };
    }
  }

  // Add documents to terms
  for (const term in termIndex) {
    if (term in termCounts) {
      const termLen = term.split(' ').length;
      termIndex[term].docs[pageUrl] = {
        docLen: docLen - termLen + 1, // Document ngram length
        termCount: termCounts[term], // Term count in document
      };
    }
  }

  // Update index files
  const globalIndex = createGlobalIndexBasic(termIndex);
  fs.writeFileSync(TFIDF_INDEX, formatIndex(numDocs, termIndex));
  fs.writeFileSync(GLOBAL_INDEX, globalIndex);
}

/* Converts a TF-IDF index to a TF-IDF global index. */
function createGlobalIndexTFIDF(numDocs, termIndex) {
  return createGlobalIndex(termIndex, (docCount, doc) => {
    const tf = doc.termCount / doc.docLen;
    const idf = Math.log10(numDocs / docCount);
    return Math.round(tf * idf * 1000) / 1000;
  });
}

/* Converts a TF-IDF index to a frequency count global index. This function is
   equivalent to the basic pipeline and passes all the basic tests. */
function createGlobalIndexBasic(termIndex) {
  return createGlobalIndex(termIndex, (docCount, doc) => {
    return doc.termCount;
  });
}

/* Creates a global index with a document rank function. */
function createGlobalIndex(termIndex, docRankFn) {
  // Alphabetically sort terms
  const lines = [];
  const sortedTerms = Object.keys(termIndex);
  sortedTerms.sort();

  for (const term of sortedTerms) {
    // Create document list
    const docs = [];
    for (const doc in termIndex[term].docs) {
      docs.push({
        url: doc,
        rank: docRankFn(termIndex[term].docCount, termIndex[term].docs[doc]),
      });
    }

    // Sort documents by rank in descending order
    docs.sort((a, b) => b.rank - a.rank);
    const parts = [];
    for (const doc of docs) {
      parts.push(doc.url);
      parts.push(doc.rank.toString());
    }
    lines.push(`${term} | ${parts.join(' ')}`);
  }

  return lines.join('\n');
}

/* Parses the content of the global TF-IDF index as JSON. */
function parseIndex(content) {
  const lines = content.split('\n');
  const numDocs = lines.length == 0 ? 0 : +lines[0];
  const termIndex = {};

  for (let l = 1; l < lines.length; l += 1) {
    const parts = lines[l].split(' | ');
    const term = parts[0];
    const docCount = +parts[1];
    termIndex[term] = {
      docCount,
      docs: {},
    };

    const docs = parts[2].split(' ');
    for (let d = 0; d < docs.length; d += 3) {
      termIndex[term].docs[docs[d]] = {
        docLen: +docs[d + 1],
        termCount: +docs[d + 2],
      };
    }
  }

  return [numDocs, termIndex];
}

/* Formats the global TF-IDF index JSON as text. */
function formatIndex(numDocs, termIndex) {
  const lines = [numDocs.toString()];
  for (const term in termIndex) {
    const line = `${term} | ${termIndex[term].docCount.toString()}`;
    const docs = [];
    for (const doc in termIndex[term].docs) {
      docs.push(doc);
      docs.push(termIndex[term].docs[doc].docLen.toString());
      docs.push(termIndex[term].docs[doc].termCount.toString());
    }
    lines.push(`${line} | ${docs.join(' ')}`);
  }
  return lines.join('\n');
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
