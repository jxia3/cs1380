/* A service that indexes pages and manages the global search index. */

const log = require("../util/log.js");
const util = require("../util/util.js");

const QUEUE_KEY = "index-queue";
const NGRAM_LEN = 3;

const queueMutex = util.sync.createMutex();

/**
 * Starts the index loop. This internal function does not accept a callback and
 * should not be called by external services.
 */
function _start() {
  let active = false;
  module.exports._interval = setInterval(() => {
    // Check if another iteration is active
    if (active) {
      return;
    }
    active = true;

    queueMutex.lock(() => {
      global.distribution.local.store.get(QUEUE_KEY, (error, queue) => {
        // Check if there is an item in the queue
        if (error || queue.length === 0) {
          queueMutex.unlock(() => {
            active = false;
          });
          return;
        }

        // Extract the first URL and index the page
        const url = queue.shift();
        global.distribution.local.store.put(queue, QUEUE_KEY, (error, result) => {
          queueMutex.unlock(() => {
            indexPage(url, (error, result) => {
              active = false;
            });
          });
        });
      });
    });
  }, 500);
}

/**
 * Adds a URL to the indexing queue.
 */
function queuePage(url, callback) {
  queueMutex.lock(() => {
    log(`Adding page ${url} to the index queue`);
    global.distribution.local.store.get(QUEUE_KEY, (error, queue) => {
      if (error) {
        queue = [url];
      } else {
        queue.push(url);
      }
      global.distribution.local.store.put(queue, QUEUE_KEY, (error, result) => {
        queueMutex.unlock(() => callback(error, result));
      });
    });
  });
}

/**
 * Downloads a page with a URL and updates the distributed index.
 */
function indexPage(url, callback) {
  if (typeof url === "string" && url.endsWith("/")) {
    url = url.slice(0, -1);
  }
  callback = callback === undefined ? (error, result) => {} : callback;

  util.search.downloadPage(url, (error, data) => {
    if (error) {
      callback(error, null);
      return;
    }
    const {title, content} = extractText(data);
    console.log("title:", title);
    console.log("content:", content);
    const terms = extractTerms(title, content);
    console.log(terms);
  });
}

/**
 * Parses the title and text content in a page.
 */
function extractText(content) {
  const TITLE_REGEX = /<title>([\S\s]+?)<\/title>/;
  const DISCARD_REGEX = /<(head|script|style|a|button)[\S\s]*?<\/\1>/g;
  const TAG_REGEX = /<[^>]*>/g;
  const SPECIAL_CHARS_REGEX = /[^a-zA-Z0-9`~!@#$%^&*()\-_=+\[\]\{\}\\|;:'",<.>/? \n]+/g;
  const HTML_CODES = {
    "&quot;": "\"",
    "&#34;": "\"",
    "&amp;": "&",
    "&#38;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&nbsp;": " ",
  };

  // Extract title in title tag
  let title = null;
  const titleMatch = TITLE_REGEX.exec(content);
  if (titleMatch !== null) {
    const matchContent = titleMatch[1].replaceAll(/<[^>]*>/g, "").trim();
    if (matchContent !== "") {
      title = matchContent;
      content = content.replace(TITLE_REGEX, "");
    }
  }

  // Remove HTML tags and collapse whitespace
  content = content.replaceAll(DISCARD_REGEX, " ");
  content = content.replaceAll(TAG_REGEX, " ");
  for (const code in HTML_CODES) {
    content = content.replaceAll(code, HTML_CODES[code]);
  }
  content = content.replaceAll(SPECIAL_CHARS_REGEX, " ");
  content = content.replaceAll(/\s*\n+\s*/g, "\n");
  content = content.replaceAll(/[^\S\n\r]+/g, " ");
  content = content.trim();

  // Extract title from body
  if (title === null) {
    if (content !== "") {
      const lineEnd = content.indexOf("\n");
      const line = lineEnd !== -1 ? content.slice(0, lineEnd) : content;
      const words = line.split(" ");
      title = words.slice(0, 10).join(" ");
    } else {
      title = "<unknown>";
    }
  }

  return {title, content};
}

/**
 * Extracts key terms from a page title and text content. A context segment around the first few occurrences
 * of each term is also extracted. Terms in the title are weighted 5x heavier than terms in the body.
 */
function extractTerms(title, text) {
  const termIndex = {};
  for (const line of text.split("\n")) {
    console.log(line);
    for (const term of calcTerms(line)) {
      console.log(term);
    }
  }
  return termIndex;
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
  const keywords = words.filter((w) => !util.stopwords.has(w.text));
  const terms = [];
  for (let n = 1; n <= NGRAM_LEN; n += 1) {
    for (let s = 0; s < keywords.length - n + 1; s += 1) {
      const term = [];
      for (let w = 0; w < n; w += 1) {
        term.push(keywords[s + w].text);
      }
      terms.push({
        text: term.join(" "),
        start: keywords[s].start,
        end: keywords[s + n - 1].end,
      });
    }
  }

  return terms;
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

module.exports = {queuePage, _start};
