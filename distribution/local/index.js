/* A service that indexes pages and manages the global search index. */

const log = require("../util/log.js");
const params = require("../params.js");
const util = require("../util/util.js");

const GROUP = params.searchGroup;
const NGRAM_LEN = params.ngramLen;
const QUEUE_KEY = params.indexQueue;
const CRAWL_SETTING = params.crawlSetting;
const ACTIVE_LIMIT = 3;
const CONTEXT_COUNT = 2;
const CONTEXT_WORDS = 5;
const MAX_CONTEXT_LEN = 50;

let stopped = false;

/**
 * Initializes the queue and starts the index loop. This internal function does not accept a callback
 * and should not be called by external services.
 */
function _start(clearQueue, callback) {
  if (callback === undefined) {
    throw new Error("Start index received no callback");
  }
  if (clearQueue) {
    global.distribution.local.store.put([], QUEUE_KEY, callback);
  } else {
    global.distribution.local.store.tryGet(QUEUE_KEY, (error, exists, result) => {
      if (error) {
        callback(error, null);
      } else if (exists) {
        callback(null, null);
      } else {
        global.distribution.local.store.put([], QUEUE_KEY, callback);
      }
    });
  }

  let active = 0;

  // If indexing directly, the index queue will not be used
  if (CRAWL_SETTING !== "index-directly") {
    module.exports._interval = setInterval(() => {
      if (active > ACTIVE_LIMIT) {
        return;
      }
      active += 1;
      global.distribution.local.atomicStore.getAndModify(QUEUE_KEY, {
        modify: (queue) => {
          // Extract the first element from the queue
          if (queue.length === 0) {
            return null;
          }
          const url = queue.shift();
          return {
            value: queue,
            carry: url,
          };
        },
        default: () => ({
          value: [],
          carry: null,
        }),
        callback: (error, url) => {
          // Index a valid URL
          if (error) {
            console.error(error);
            active -= 1;
            return;
          }
          if (url !== null) {
            indexUrl(url, (errors, results) => {
              if (Object.keys(errors).length > 0) {
                console.error(Object.values(errors)[0]);
              }
              active -= 1;
            });
          } else {
            active -= 1;
          }
        },
      });
    }, 500);
  }
}

/**
 * Stops the index loop. This internal function does not accept a callback and should not
 * be called by external services.
 */
function _stop(callback) {
  if (callback === undefined) {
    throw new Error("Stop index received no callback");
  }
  stopped = true;
  if (CRAWL_SETTING !== "index-directly") {
    clearInterval(module.exports._interval);
  }
  callback(null, null);
}

/**
 * Adds a URL to the indexing queue.
 */
function queueUrl(url, callback) {
  callback = callback === undefined ? (error, result) => {} : callback;
  url = util.search.normalizeUrl(url);
  global.distribution.local.atomicStore.getAndModify(QUEUE_KEY, {
    modify: (queue) => {
      log(`Adding page ${url} to the index queue`, "index");
      queue.push(url);
      return {
        value: queue,
        carry: null,
      };
    },
    default: () => {
      log(`Adding page ${url} to the index queue`, "index");
      return {
        value: [url],
        carry: null,
      };
    },
    callback: (error, result) => {
      callback(error, null);
    },
  });
}

/**
 * Downloads a page with a URL and updates the distributed index.
 */
function indexUrl(url, callback) {
  callback = callback === undefined ? (error, result) => {} : callback;
  url = util.search.normalizeUrl(url);
  util.search.downloadPage(url, (error, data) => {
    if (error || data === null) {
      callback({}, null);
    } else {
      const {title, content} = extractText(data);
      indexContent(url, title, content, callback);
    }
  });
}

/**
 * Indexes the content in a page.
 */
function indexContent(url, title, content, callback) {
  if (!global.distribution[GROUP]?._isGroup) {
    throw new Error(`Group '${GROUP}' does not exist`);
  }
  callback = callback === undefined ? (error, result) => {} : callback;
  url = util.search.normalizeUrl(url);

  log(`Indexing page ${url}`, "index");
  const {terms, docLen} = extractTerms(title, content);
  if (stopped) {
    log(`Aborted indexing ${url}`, "index");
    callback({}, {});
    return;
  }

  global.distribution[GROUP].index.updateIndex(url, terms, docLen, (errors, results) => {
    log(`Finished indexing page ${url}`, "index");
    callback(errors, results);
    global.distribution[GROUP].search.updateCounts(0, 1, (error, result) => {
      if (error) {
        console.error(error);
      }
    });
  });
}

/**
 * Parses the title and text content in a page.
 */
function extractText(content) {
  const TITLE_REGEX = /<title>([\S\s]+?)<\/title>/;
  const METADATA_REGEX = /<(head|script|style|button)[\S\s]*?<\/\1>/g;
  const LINK_COMPONENT_REGEX = /(?<!<td)>\s*?<a[\S\s]*?<\/a>\s*?</g;
  const EMPTY_LINK_REGEX = /<a\s[^>]*?><\/a>/g;
  const TAG_REGEX = /<[^>]*>/g;
  const SPECIAL_CHAR_REGEX = /[^a-zA-Z0-9`~!@#$%^&*()\-_=+\[\]\{\}\\|;:'",<.>/? \n]+/g;
  const HTML_CODES = {
    "&quot;": "\"",
    "&#34;": "\"",
    "“": "\"",
    "”": "\"",
    "&#8217;": "'",
    "&#x27;": "'",
    "‘": "'",
    "’": "'",
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
    if (title !== null) {
      title = title.replaceAll(code, HTML_CODES[code]);
    }
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
  title = title.replaceAll(/\s+/g, " ").trim();

  return {title, content};
}

/**
 * Extracts key terms from a page title and text content. A context segment around the first few occurrences
 * of each term is also extracted. Terms in the title are weighted heavier than terms in the body.
 */
function extractTerms(title, text) {
  // Extract terms from title
  const termIndex = {};
  const docLen = new Array(NGRAM_LEN + 1).fill(0);
  const {terms: titleTerms, wordCount: titleCount} = util.search.calcTerms(title);
  for (let n = 1; n <= NGRAM_LEN; n += 1) {
    docLen[n] += Math.max(titleCount - n + 1, 0);
  }

  // Add title terms with a high score
  for (const term of titleTerms) {
    if (!(term.text in termIndex)) {
      termIndex[term.text] = {
        length: term.length,
        score: 0,
        title,
        context: [],
      };
    }
    termIndex[term.text].score += 5;
  }

  // Format text and lines
  text = text
      .replaceAll(/\n+/g, "\n")
      .replaceAll(/ +\./g, ". ")
      .replaceAll(/ +,/g, ", ")
      .replaceAll(/ +/g, " ")
      .trim();
  const lines = text.split("\n").map((l) => l.trim()).filter((l) => l !== "");
  text = lines.join("\n");

  // Extract terms and context from lines
  let textIndex = 0;
  for (let l = 0; l < lines.length; l += 1) {
    const {terms, wordCount} = util.search.calcTerms(lines[l]);
    for (let n = 1; n <= NGRAM_LEN; n += 1) {
      docLen[n] += Math.max(wordCount - n + 1, 0);
    }
    for (const term of terms) {
      if (!(term.text in termIndex)) {
        termIndex[term.text] = {
          length: term.length,
          score: 0,
          title,
          context: [],
        };
      }
      termIndex[term.text].score += wordCount > 2 ? 1 : 0.5;
      if (termIndex[term.text].context.length < CONTEXT_COUNT) {
        termIndex[term.text].context.push(extractContext(text, textIndex + term.start, textIndex + term.end));
      }
    }
    textIndex += lines[l].length + 1;
  }

  // Weight scores by the document length
  const factor = Math.max(0.2, Math.min(docLen[0] / 50, 1));
  for (const term in termIndex) {
    termIndex[term].score *= factor;
  }

  return {terms: termIndex, docLen};
}

/**
 * Extracts the context around a term section in a text block.
 */
function extractContext(text, start, end) {
  const leftStream = createCharStream(text, start, -1);
  leftStream.next();
  const rightStream = createCharStream(text, end - 1, 1);
  rightStream.next();

  const {words: leftReverse, count: leftCount} = readContext(leftStream);
  const leftWords = leftReverse.map((w) => w.split("").reverse().join(""));
  leftWords.reverse();
  const left = leftWords.join(" ");
  const {words: rightWords, count: rightCount} = readContext(rightStream);
  const right = rightWords.join(" ");
  const term = text.slice(start, end);

  return {
    text: `${left} ${term} ${right}`.trim(),
    start: start - leftCount,
    end: end + rightCount,
  };
}

/**
 * Reads a side of a context from a character stream.
 */
function readContext(stream) {
  const context = [];
  let contextLen = 0;
  let streamCount = 0;
  let currentWord = "";

  // Clear spaces from beginning of context
  let char = stream.next();
  streamCount += 1;
  while (char !== null && /\s+/.test(char)) {
    char = stream.next();
    streamCount += 1;
  }

  // Add words to context
  while (char !== null && context.length < CONTEXT_WORDS && contextLen < MAX_CONTEXT_LEN) {
    if (!/\s+/.test(char)) {
      currentWord += char;
    } else if (currentWord !== "") {
      context.push(currentWord);
      currentWord = "";
    }
    char = stream.next();
    contextLen += 1;
    streamCount += 1;
  }
  if (currentWord !== "") {
    context.push(currentWord);
  }

  return {words: context, count: Math.max(streamCount - 1, 0)};
}

/**
 * Creates a character stream starting at an index in a text block.
 */
function createCharStream(text, index, increment) {
  let finished = index < 0 || index >= text.length;
  return {
    next: () => {
      if (finished) {
        return null;
      }
      const char = text[index];
      index += increment;
      if (index < 0 || index >= text.length) {
        finished = true;
      }
      return /\s+/.test(char) ? " " : char;
    },
  };
}

/**
 * Updates the local index of terms on a node.
 */
function updateIndex(url, terms, docLen, callback) {
  callback = callback === undefined ? (error, result) => {} : callback;
  let active = Object.keys(terms).length;
  let updateError = null;

  for (const term in terms) {
    const key = util.search.createFullTermKey(term);
    const config = {gid: GROUP, key};
    global.distribution.local.atomicStore.getAndModify(config, {
      modify: (index) => {
        // Insert URL into index
        if (url in index) {
          throw new Error(`Page ${url} is already in the index`);
        }
        index[url] = util.search.compressEntry({
          score: terms[term].score / docLen[terms[term].length],
          title: terms[term].title,
          context: terms[term].context,
        });
        return {value: index};
      },
      default: () => {
        // Create index with URL
        const index = {};
        index[url] = util.search.compressEntry({
          score: terms[term].score / docLen[terms[term].length],
          title: terms[term].title,
          context: terms[term].context,
        });
        return {value: index};
      },
      callback: (error, result) => {
        if (error && updateError === null) {
          updateError = error;
        }
        active -= 1;
        if (active === 0) {
          callback(updateError, null);
        }
      },
    });
  }
}

module.exports = {
  queueUrl,
  indexContent,
  extractText,
  extractTerms,
  updateIndex,
  _start,
  _stop,
};
