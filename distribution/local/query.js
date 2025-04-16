const util = require("../util/util.js");
const search = require("../util/search.js");
const params = require("../params.js");
const termLookup = require("../local/term-lookup.js");
const fs = require("fs");
const path = require('path');

const GROUP = params.searchGroup;
const USE_QUERY = params.enableQuery;
const MAX_SEARCH_RESULTS = 10;
const NUM_DOCUMENTS = 1000;
const USE_DOMAIN_AUTHORITY = false;


// LOAD IN WORD INFORMATION
const commonWordsSet = new Set();

const commonData = fs.readFileSync(path.resolve(__dirname, "../../data/5000-words.txt"));
const words = commonData.toString().trim().split(/\s+/g);

const englishData = fs.readFileSync(path.resolve(__dirname, "../../data/english-words.txt"), 'utf-8')
const lines = englishData.split(/\r?\n/).filter(Boolean);
const englishWords = new Set(lines.map(word => word.toLowerCase()));

const frequentWords = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../../data/frequent.json")));

// termLookup.lookup(frequentWords, () => {});

for (const word of words) {
  commonWordsSet.add(word);
}

for (const frequentWord of frequentWords) {
  commonWordsSet.add(frequentWord.text);
}

const commonWords = [...commonWordsSet];

function checkResults(results) {
  const emptyResults = []
  for (const result in results) {
    if (Object.keys(results[result]).length == 0) {
      emptyResults.push(result);
    }
  }

  return emptyResults;
}


function processResults(results) {
  const urls = {};
  const seenTitles = new Set();

  for (const result in results) {
    const numUrls = Object.keys(results[result]).length;
    const idf = Math.log((1 + NUM_DOCUMENTS) / (1 + numUrls));
    for (const url in results[result]) {
      const decompressed = results[result][url]
      if (!(seenTitles.has(decompressed.title))) {
        seenTitles.add(decompressed.title);
        if (!(url in urls)) {
          urls[url] = {score: 0, title: "", context: []};
        }
        urls[url].score += decompressed.score * idf;
  
        if (USE_DOMAIN_AUTHORITY) {
          const domain = new URL(url).hostname;
          // apply some function to the score
        }
        
        if (decompressed.context.length > 0) {
          urls[url].context.push(decompressed.context[0]);
        }
        urls[url].title = decompressed.title;
      }
    }
  }

  for (const url in urls) {
    const mergedContext = mergeIntervals(urls[url].context);
    urls[url].context = mergedContext;
  }

  return urls;
}

/**
 * Takes in a list of context objects, and returns the first merged interval
 */
function mergeIntervals(contexts) {
  if (contexts.length == 0) {
    return "";
  }

  contexts.sort((a, b) => a.start - b.start);
  let merged = contexts[0];

  for (let i = 1; i < contexts.length; i++) {
    const curr = contexts[i];
    const overlap = Math.min(merged.end, curr.end) - Math.max(merged.start, curr.start);

    if (overlap > 0) {
      const len = curr.start - merged.start;
      const mergedText = merged.text.slice(0, len);
      merged.text = mergedText + curr.text;
      merged.end = Math.max(merged.end, curr.end);
    } else {
      break;
    }
  }
  return merged.text;
}

const keyboardProximity = {
  a: ['q', 'w', 's', 'z'],
  b: ['v', 'g', 'h', 'n'],
  c: ['x', 'd', 'f', 'v'],
  d: ['s', 'e', 'r', 'f', 'c', 'x'],
  e: ['w', 's', 'd', 'r'],
  f: ['d', 'r', 't', 'g', 'v', 'c'],
  g: ['f', 't', 'y', 'h', 'b', 'v'],
  h: ['g', 'y', 'u', 'j', 'n', 'b'],
  i: ['u', 'j', 'k', 'o'],
  j: ['h', 'u', 'i', 'k', 'm', 'n'],
  k: ['j', 'i', 'o', 'l', 'm'],
  l: ['k', 'o', 'p'],
  m: ['n', 'j', 'k'],
  n: ['b', 'h', 'j', 'm'],
  o: ['i', 'k', 'l', 'p'],
  p: ['o', 'l'],
  q: ['a', 'w'],
  r: ['e', 'd', 'f', 't'],
  s: ['a', 'w', 'e', 'd', 'x', 'z'],
  t: ['r', 'f', 'g', 'y'],
  u: ['y', 'h', 'j', 'i'],
  v: ['c', 'f', 'g', 'b'],
  w: ['q', 'a', 's', 'e'],
  x: ['z', 's', 'd', 'c'],
  y: ['t', 'g', 'h', 'u'],
  z: ['a', 's', 'x'],
};

function getKeyboardCost(a, b) {
  if (a === b) return 0;
  if (keyboardProximity[a]?.includes(b)) return 0.6;
  return 1;
}

function keyboardLevenshtein(a, b) {
  a = a.toLowerCase();
  b = b.toLowerCase();

  const lenA = a.length;
  const lenB = b.length;

  const dp = Array.from({ length: lenA + 1 }, () => Array(lenB + 1).fill(0));

  for (let i = 0; i <= lenA; i++) dp[i][0] = i;
  for (let j = 0; j <= lenB; j++) dp[0][j] = j;

  for (let i = 1; i <= lenA; i++) {
    for (let j = 1; j <= lenB; j++) {
      const cost = getKeyboardCost(a[i - 1], b[j - 1]);

      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,        // deletion
        dp[i][j - 1] + 1,        // insertion
        dp[i - 1][j - 1] + cost  // substitution (keyboard-aware)
      );

      // Transposition (Damerau)
      if (
        i > 1 && j > 1 &&
        a[i - 1] === b[j - 2] &&
        a[i - 2] === b[j - 1]
      ) {
        dp[i][j] = Math.min(
          dp[i][j],
          dp[i - 2][j - 2] + 0.5
        );
      }
    }
  }

  const baseDistance = dp[lenA][lenB];
  const normalized = baseDistance / ((a.length + b.length) / 2);
  // const lengthPenalty = Math.abs(lenA - lenB) * 0.25;
  return normalized;
}

function spellcheck(query, words) {
  const distances = words.map((word, index) => {
    let distance = keyboardLevenshtein(query, word);

    if (index < 5) {
      distance *= 0.5;
    }
    return { word, distance };
  });

  // Sort by distance
  distances.sort((a, b) => a.distance - b.distance);

  return distances[0];
}



function waitForInput(callback) {
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding("utf8");

  process.stdin.once("data", (key) => {
    process.stdin.setRawMode(false);
    process.stdin.pause();

    // Check key press
    if (key === '\r') {
      callback('enter');
    } else if (key === '\u001B' || key === '\u0003') { // ESC or CTRL+C
      callback('esc');
    } else if (key.toLowerCase() === 'y') {
      callback('y');
    } else if (key.toLowerCase() === 'n') {
      callback('n');
    } else {
      callback('other', key); // fallback for any other key
    }
  });
}

function askNewSearch() {
  console.log("Would you like to search for a new query? (y/n)");

  function handleResponse(key) {
    if (process.stdin.isPaused()) {
      process.stdin.resume();
    }

    if (key === 'y') {
      runSearch();
    } else if (key === 'n' || key === 'esc') {
      process.exit();
    } else {
      waitForInput(handleResponse); // wait again
    }
  }
  waitForInput(handleResponse);
}

function otherSearch(newQuery) {
  function handleResponse(key) {
    if (process.stdin.isPaused()) {
      process.stdin.resume();
    }

    if (key === 'y') {
      lookupQuery(newQuery, () => {});
    } else if (key === 'n') {
      askNewSearch();
    } else if (key === 'esc' || key === '\u0003') {
      process.exit();
    } else {
      waitForInput(handleResponse); // wait again
    }
  }
  waitForInput(handleResponse);
}

function lookupQuery(query, callback) {
  callback = callback === undefined ? (error, result) => {} : callback;

  // enterPressed = false;
  const words = search.calcTerms(query).terms;

  global.distribution[GROUP].query.batchTerms(words, (errors, results) => {
    const emptyResults = checkResults(results);
    let newQuery;

    const originalWords = query.trim().split(/\s+/);
    const freshWords = [];

    // Spellcheck metrics
    for (const word of originalWords) {
      const distance = spellcheck(word, commonWords);
      if (distance.distance > 0 && distance.distance < 0.5 && emptyResults.includes(word) && !englishWords.has(word)) {
        freshWords.push(distance.word);
      } else {
        freshWords.push(word);
      }
    }
    newQuery = freshWords.join(" ");

    if (emptyResults.length === Object.keys(results).length) {
      if (newQuery != query) {
        console.log(`No search results found for query "${query}". Did you mean "${newQuery}"? (y/n)`);
        otherSearch(newQuery);
      } else {
        console.log(`No search results found for query "${query}".`);
        askNewSearch();
      }
    } 
    else {
      const processedResults = processResults(results);

      const sortedUrls = Object.entries(processedResults)
                      .sort((a, b) => b[1].score - a[1].score)
                      .map(([url, data]) => ({ url, ...data }));
      const topUrls = sortedUrls.slice(0, MAX_SEARCH_RESULTS);
      const numUrls = topUrls.length;

      console.log(`\nHere are the top ${numUrls} result(s) for "${query}":\n`);
      for (const url of topUrls) {
          console.log("URL:      " + url.url);
          // console.log("Score:    " + url.score);
          console.log("Title:    " + url.title);
          console.log("Context:  " + "..." + url.context + "...");
          console.log("—".repeat(40));
      }

      if (emptyResults.length > 0 && newQuery != query) {
        console.log(`\nDid you mean "${newQuery}"? (y/n)`);
        otherSearch(newQuery);
      } else {
        askNewSearch();
      }
    }
  });
}

function runSearch() {
  console.log("🔍 Enter your search query:");
  process.stdout.write("> ");

  process.stdin.setEncoding("utf8");

  process.stdin.once("data", (input) => {
    const query = input.trim();
    lookupQuery(query, () => {});
  });
}


module.exports = {runSearch};