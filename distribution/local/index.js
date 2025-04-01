/* A service that indexes pages and manages the global search index. */

const log = require("../util/log.js");
const util = require("../util/util.js");

const QUEUE_KEY = "index-queue";
const CONTEXT_COUNT = 3;
const CONTEXT_WORDS = 4;
const MAX_CONTEXT_LEN = 50;

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
    const terms = extractTerms(title, content);
    console.log(terms);
  });
}

/**
 * Parses the title and text content in a page.
 */
function extractText(content) {
  const TITLE_REGEX = /<title>([\S\s]+?)<\/title>/;
  const METADATA_REGEX = /<(head|script|style|button)[\S\s]*?<\/\1>/g;
  const LINK_COMPONENT_REGEX = />\s*?<a[\S\s]*?<\/a>\s*?</g;
  const EMPTY_LINK_REGEX = /<a\s[^>]*?><\/a>/g;
  const TAG_REGEX = /<[^>]*>/g;
  const SPECIAL_CHAR_REGEX = /[^a-zA-Z0-9`~!@#$%^&*()\-_=+\[\]\{\}\\|;:'",<.>/? \n]+/g;
  const HTML_CODES = {
    "&quot;": "\"",
    "&#34;": "\"",
    "&amp;": "&",
    "&#38;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&nbsp;": " ",
    "&#160;": " ",
    "‘": "'",
    "’": "'",
    "“": "\"",
    "”": "\"",
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
  content = content.replaceAll(METADATA_REGEX, " ");
  content = content.replaceAll(LINK_COMPONENT_REGEX, "><");
  content = content.replaceAll(EMPTY_LINK_REGEX, " ");
  content = content.replaceAll(TAG_REGEX, " ");
  for (const code in HTML_CODES) {
    content = content.replaceAll(code, HTML_CODES[code]);
  }
  content = content.replaceAll(SPECIAL_CHAR_REGEX, " ");
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
 * of each term is also extracted. Terms in the title are weighted heavier than terms in the body.
 */
function extractTerms(title, text) {
  // Extract terms from title
  const termIndex = {};
  const {terms: titleTerms} = util.search.calcTerms(title);
  for (const term of titleTerms) {
    if (!(term.text in termIndex)) {
      termIndex[term.text] = {
        frequency: 0,
        context: [],
      };
    }
    termIndex[term.text].frequency += 5;
    if (termIndex[term.text].context.length === 0) {
      termIndex[term.text].context.push(title);
    }
  }

  // Format lines
  const lines = text.split("\n")
      .map((l) => l.replaceAll(/ +\./g, ". ").replaceAll(/ +,/g, ", ").replaceAll(/ +/g, " ").trim())
      .filter((l) => l !== "");

  // Extract terms and context from lines
  for (let l = 0; l < lines.length; l += 1) {
    const {terms, wordCount} = util.search.calcTerms(lines[l]);
    for (const term of terms) {
      if (!(term.text in termIndex)) {
        termIndex[term.text] = {
          frequency: 0,
          context: [],
        };
      }
      termIndex[term.text].frequency += wordCount > 2 ? 1 : 0.5;
      if (termIndex[term.text].context.length < CONTEXT_COUNT) {
        termIndex[term.text].context.push(extractContext(lines, l, term));
      }
    }
  }

  return termIndex;
}

/**
 * Extracts the context around a term in a line.
 */
function extractContext(lines, lineIndex, term) {
  const leftStream = createCharStream(lines, lineIndex, term.start, -1);
  leftStream.next();
  const left = readContext(leftStream).map((w) => w.split("").reverse().join("")).join(" ");

  const rightStream = createCharStream(lines, lineIndex, term.end - 1, 1);
  rightStream.next();
  const right = readContext(rightStream).join(" ");

  return `${left} ${term.text} ${right}`.trim();
}

/**
 * Reads a side of a context from a character stream.
 */
function readContext(stream) {
  const context = [];
  let contextLen = 0;
  let currentWord = "";

  // Clear spaces from beginning of context
  let char = stream.next();
  while (char !== null && char === " ") {
    char = stream.next();
  }

  // Add words to context
  while (char !== null && context.length < CONTEXT_WORDS && contextLen < MAX_CONTEXT_LEN) {
    if (char !== " ") {
      currentWord += char;
    } else if (currentWord !== "") {
      context.push(currentWord);
      currentWord = "";
    }
    char = stream.next();
    contextLen += 1;
  }
  if (currentWord !== "") {
    context.push(currentWord);
  }

  return context;
}

/**
 * Creates a character stream starting at an index in a line.
 */
function createCharStream(lines, lineIndex, charIndex, increment) {
  let finished = lineIndex < 0 || lineIndex >= lines.length
    || (lineIndex === 0 && charIndex < 0)
    || (lineIndex === lines.length - 1 && charIndex >= lines[lineIndex].length);
  let lineBreak = false;

  return {
    next: () => {
      // Check special cases
      if (finished) {
        return null;
      }
      if (lineBreak) {
        lineBreak = false;
        return " ";
      }

      // Get current character and increment indices
      const char = lines[lineIndex][charIndex];
      charIndex += increment;
      if (charIndex < 0 || charIndex >= lines[lineIndex].length) {
        lineIndex += increment;
        if (lineIndex < 0 || lineIndex >= lines.length) {
          finished = true;
        } else {
          charIndex = increment === 1 ? 0 : lines[lineIndex].length - 1;
          lineBreak = true;
        }
      }

      return char;
    },
  };
}

module.exports = {queuePage, _start};
