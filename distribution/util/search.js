/* A module with operations for a search engine. */

const params = require("../params.js");

const fs = require("fs");
const http = require("http");
const https = require("https");
const path = require("path");
const {URL} = require("url");

const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36";
const REQUEST_TIMEOUT = 60000;
const NGRAM_LEN = params.ngramLen;

const stopwords = new Set();

// Load stopwords asynchronously on startup
fs.readFile(path.join(__dirname, "../../data/stopwords.txt"), (error, data) => {
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
function downloadPage(url, callback, redirectCount = 0) {
  if (callback === undefined) {
    throw new Error("No callback provided");
  }

  const guardedCallback = global.distribution.util.sync.createGuardedCallback(callback);
  if (ignoreURL(url)) {
    return guardedCallback(null, null);
  }
  // Prevent infinite redirects
  if (redirectCount > 10) {
    return guardedCallback(new Error("Too many redirects"), null);
  }

  const module = url.startsWith("https") ? https : http;
  const request = module.request(url, {
    method: "GET",
    headers: {
      "User-Agent": USER_AGENT,
    },
    timeout: REQUEST_TIMEOUT,
  }, (response) => {
    // Check for redirects
    if (response.statusCode >= 301 && response.statusCode <= 308 && response.headers.location) {
      // Clean up listeners on current request
      request.removeAllListeners("timeout");
      request.removeAllListeners("error");
      request.on("error", () => {});
      request.destroy();

      // Resolve redirect URL to base URL
      let absoluteUrl = null;
      try {
        const redirectUrl = response.headers.location;
        absoluteUrl = new URL(redirectUrl, url).toString();
      } catch {
        return guardedCallback(null, null);
      }
      downloadPage(absoluteUrl, guardedCallback, redirectCount + 1); // Recursively follow redirect
    } else {
      handleResponse(response, guardedCallback);
    }
  });

  request.on("timeout", () => {
    request.destroy(new Error("Request timed out"));
  });

  request.on("error", (error) => {
    if (!request.destroyed) {
      request.destroy();
    }
    guardedCallback(error, null);
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
 * Checks if a URL should be ignored
 */
function ignoreURL(url) {
  // Convert URL to lowercase for case-insensitive checks
  const lowerUrl = url.toLowerCase();
  if (!lowerUrl.startsWith("https") && !lowerUrl.startsWith("http")) {
    return true;
  }

  // Check for bad file extensions
  const badExtensions = [
    ".pdf", ".csv", ".jpg", ".jpeg", ".png",
    ".mp4", ".zip", ".webm", ".webp", ".tar.gz", ".gz",
  ];
  for (const extension of badExtensions) {
    if (lowerUrl.endsWith(extension)) {
      return true;
    }
  }

  // Check for authentication-related domains
  const authDomains = [
    "accounts.google.com", "login", "auth", "signin", "sso", "idp", "identity",
  ];
  const urlHost = new URL(url).hostname.toLowerCase();
  for (const domain of authDomains) {
    if (urlHost.includes(domain)) {
      return true;
    }
  }

  // Check for authentication-related paths
  const authPaths = [
    "/auth", "/oauth", "/oauth2", "/login", "/signin", "/sso", "/account",
  ];
  const urlPath = new URL(url).pathname.toLowerCase();
  for (const path of authPaths) {
    if (urlPath.includes(path)) {
      return true;
    }
  }
  // If none of the above conditions match, the URL is relevant
  return false;
}

/**
 * Extracts all valid, absolute HTTP/HTTPS URLs from HTML content.
 * Uses the provided baseUrl to resolve relative URLs.
 *
 * @param {string} htmlContent The HTML content of the page.
 * @param {string} baseUrl The base URL of the page where the HTML was downloaded from.
 * @returns {string[]} An array of absolute URLs found.
 */
function extractUrls(htmlContent, baseUrl) {
  if (!htmlContent || !baseUrl) {
    return [];
  }

  const A_HREF_REGEX = /<a\s+(?:[^>]*?\s+)?href=(["'])(.*?)\1|<a\s+(?:[^>]*?\s+)?href=([^\s>]+)/gi;
  const uniqueUrls = new Set();
  let match;

  while ((match = A_HREF_REGEX.exec(htmlContent)) !== null) {
    // Extract the URL from the correct capture group
    // match[2] is for quoted URLs (href="...")
    // match[3] is for unquoted URLs (href=...)
    const href = match[2] || match[3];

    // Skip empty links, fragments, javascript calls, mailto links
    if (!href || href.startsWith("#")
        || href.toLowerCase().startsWith("javascript:")
        || href.toLowerCase().startsWith("mailto:")) {
      continue;
    }

    try {
      // Resolve the potentially relative URL against the base URL
      const absoluteUrl = new URL(href, baseUrl).toString();

      // Only crawl http and https URLs
      if (absoluteUrl.startsWith("http:") || absoluteUrl.startsWith("https:") ) {
        uniqueUrls.add(normalizeUrl(absoluteUrl));
      }
    } catch (error) {
      // Ignore URLs that cannot be parsed (e.g., malformed href or base)
    }
  }

  return Array.from(uniqueUrls);
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
  return term;
}

/**
 * Converts a full result term key to a term.
 */
function recoverFullTerm(key) {
  return key;
}

/**
 * Compresses a term entry for compact storage.
 */
function compressEntry(entry) {
  const contexts = [];
  for (const context of entry.context) {
    contexts.push([context.text, context.start, context.end]);
  }
  return [entry.score, entry.title, contexts];
}

/**
 * Decompresses a term entry from its storage representation.
 */
function decompressEntry(entry) {
  const contexts = [];
  for (const context of entry[2]) {
    contexts.push({
      text: context[0],
      start: context[1],
      end: context[2],
    });
  }
  return {
    score: entry[0],
    title: entry[1],
    context: contexts,
  };
}

module.exports = {
  normalizeUrl,
  downloadPage,
  ignoreURL,
  extractUrls,
  calcTerms,
  createFullTermKey,
  recoverFullTerm,
  compressEntry,
  decompressEntry,
};
