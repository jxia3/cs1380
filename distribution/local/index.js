/* A service that indexes pages and manages the global search index. */

const log = require("../util/log.js");
const util = require("../util/util.js");

const QUEUE_KEY = "index-queue";
const CONTEXT_COUNT = 3;

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

  const lines = text.split("\n").map((l) => l.trim());
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
  return "context"
}

module.exports = {queuePage, _start};
