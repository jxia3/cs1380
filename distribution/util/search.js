/* A module with operations for a search engine. */

const fs = require("fs");
const http = require("http");
const https = require("https");
const path = require("path");

const GROUP = "search";
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36";
const REQUEST_TIMEOUT = 60000;
const NGRAM_LEN = 2;

const stopwords = new Set();

// Load stopwords asynchronously on startup
fs.readFile(path.join(__dirname, "stopwords.txt"), (error, data) => {
  if (error) {
    throw error;
  }
  const words = data.toString().trim().split(/\s+/g);
  for (const word of words) {
    stopwords.add(word);
  }
});

/**
 * Normalizes a URL string.
 */
function normalizeUrl(url) {
  url = url.split(/[?#]/)[0];
  while (url.endsWith("/")) {
    url = url.slice(0, -1);
  }
  return url;
}

/**
 * Downloads the HTML content of a page at a URL.
 */
function downloadPage(url, callback) {
  if (callback === undefined) {
    throw new Error("No callback provided");
  }
  callback = global.distribution.util.sync.createGuardedCallback(callback);

  const module = url.startsWith("https") ? https : http;
  const request = module.request(url, {
    method: "GET",
    headers: {
      "User-Agent": USER_AGENT,
    },
    timeout: REQUEST_TIMEOUT,
  }, (response) => handleResponse(response, callback));

  request.on("timeout", () => {
    request.destroy(new Error("Request timed out"));
  });

  request.on("error", (error) => {
    callback(error, null);
  });

  request.end();
}

/**
 * Saves the HTML content from an HTTP response.
 */
function handleResponse(response, callback) {
  let content = "";
  response.on("data", (chunk) => content += chunk);
  response.on("end", () => callback(null, content));
}

/**
 * Computes the terms that are not stopwords in a line of text.
 */
function calcTerms(line) {
  const words = [];
  let currentWord = "";
  let currentStart = 0;

  let index = 0;
  while (index < line.length) {
    if (line.slice(index, index + 3) === "'s ") {
      // Remove contractions
      index += 2;
      continue;
    } else if (checkTermChar(line, currentWord, index)) {
      // Add regular character
      if (currentWord === "") {
        currentStart = index;
      }
      currentWord += line[index].toLowerCase();
    } else if (/[\s-]/.test(line[index]) && currentWord !== "") {
      // Handle end of word
      words.push({
        text: currentWord,
        start: currentStart,
        end: index,
      });
      currentWord = "";
    }
    index += 1;
  }
  if (currentWord !== "") {
    words.push({
      text: currentWord,
      start: currentStart,
      end: line.length,
    });
  }

  // Filter stopwords and compute terms
  const keywords = words.filter((w) => !checkStopword(w.text));
  const terms = [];
  for (let n = 1; n <= NGRAM_LEN; n += 1) {
    for (let s = 0; s < keywords.length - n + 1; s += 1) {
      const term = [];
      for (let w = 0; w < n; w += 1) {
        term.push(keywords[s + w].text);
      }
      terms.push({
        text: term.join(" "),
        length: term.length,
        start: keywords[s].start,
        end: keywords[s + n - 1].end,
      });
    }
  }

  return {terms, wordCount: keywords.length};
}

/**
 * Checks if the character at an index is a valid term character.
 */
function checkTermChar(line, currentWord, index) {
  const CHAR_REGEX = /[a-zA-Z0-9]/;
  const NUMBER_REGEX = /[0-9]/;

  const char = line[index];
  const prevChar = currentWord !== "" ? currentWord[currentWord.length - 1] : "";
  const nextChar = index < line.length - 1 ? line[index + 1] : "";
  if (CHAR_REGEX.test(char)) {
    return true;
  }
  if (char === "." && NUMBER_REGEX.test(prevChar) && NUMBER_REGEX.test(nextChar)) {
    return true;
  }

  return false;
}

/**
 * Checks if a word is a stopword.
 */
function checkStopword(word) {
  if (stopwords.size === 0) {
    throw new Error("No stopwords loaded");
  }
  return word.length === 1 || stopwords.has(word);
}

/**
 * Returns the storage key for the full results for a term.
 */
function createFullTermKey(term) {
  return `[${term}]-full`;
}

/**
 * Returns the storage key for the top results for a term.
 */
function createTopTermKey(term) {
  return `[${term}]-top`;
}

module.exports = {
  GROUP,
  NGRAM_LEN,
  normalizeUrl,
  downloadPage,
  calcTerms,
  createFullTermKey,
  createTopTermKey,
};
