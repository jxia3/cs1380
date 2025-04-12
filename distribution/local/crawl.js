/** @typedef {import("../types").Callback} Callback */

/* A service that crawls pages and saves relevant URLs. */

const log = require("../util/log.js");
const params = require("../params.js");
const util = require("../util/util.js");

const GROUP = params.searchGroup;
const SEEN_KEY = params.crawlSeen;
const QUEUE_KEY = params.crawlQueue;
const CRAWL_SETTING = params.crawlSetting;
const MAX_QUEUE_LEN = params.maxQueueLen;
const MAX_PAGE_LEN = params.maxPageLen;
// How many pages a single node can crawl at once
const ACTIVE_LIMIT = CRAWL_SETTING === "index-directly" ? 2 : 1;
// How often we write visited URLs list to disk (ms)
const SAVE_INTERVAL = 60000;
const CRAWL_INTERVAL = 500;

// IMPORTANT: we consider a URL as seen if crawled OR if it's currently in the queue
let SEEN_URLS = new Set();

let stopped = false;

/**
 * Initializes the queue and starts the crawl loop. This internal function does not accept a callback
 * and should not be called by external services.
 * @param {boolean} resetCrawler if true, clears the crawl queue and the seen URLs list
 * @param {Callback} callback
 */
function _start(resetCrawler, callback) {
  if (callback === undefined) {
    throw new Error("Start index received no callback");
  }

  if ((CRAWL_SETTING !== "isolate") && (CRAWL_SETTING !== "index-queue") && (CRAWL_SETTING !== "index-directly")) {
    log("Invalid crawl setting given, defaulting to isolate (will not index)", "crawl");
  }

  if (resetCrawler) {
    log("Resetting crawl queue and seen URLs list", "crawl");
    // TODO: could technically cause issues if start crawling too quickly (before these resets are done)
    global.distribution.local.store.put([], SEEN_KEY, (error, result) => {
      global.distribution.local.store.put({urls: [], domains: {}}, QUEUE_KEY, callback);
    });
  } else {
    // Sync up local SEEN_URLS with stored SEEN_URLS
    global.distribution.local.store.tryGet(SEEN_KEY, (error, exists, result) => {
      if (error) {
        callback(new Error("couldn't retrieve seen URLs on crawler _start"), null);
      } else if (exists) {
        SEEN_URLS = new Set(result);
        callback(null, null);
      }
    });
  }

  let active = 0;
  // Periodically check for new pages on the queue to crawl
  module.exports._crawlInterval = setInterval(() => {
    if (active > ACTIVE_LIMIT) {
      return;
    }
    active += 1;
    global.distribution.local.atomicStore.getAndModify(QUEUE_KEY, {
      modify: (queue) => {
        // Extract the first element from the queue
        if (queue.urls.length === 0) {
          return null;
        }
        const url = queue.urls.shift();
        const domain = getDomain(url);
        if (domain in queue.domains) {
          queue.domains[domain] -= 1;
          if (queue.domains[domain] === 0) {
            delete queue.domains[domain];
          }
        }
        return {
          value: queue,
          carry: url,
        };
      },
      default: () => ({
        value: {urls: [], domains: {}},
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
          log(`Crawling url: ${url}`, "crawl");
          crawlURL(url, (error, result) => {
            active -= 1;
          });
        } else {
          active -= 1;
        }
      },
    });
  }, CRAWL_INTERVAL);

  // Periodically saves the visited URLs list
  module.exports._saveInterval = setInterval(() => {
    const seenList = Array.from(SEEN_URLS);
    global.distribution.local.store.put(seenList, SEEN_KEY, (error, _) => {
      if (error) {
        log("Failed to save S set to disk", "crawl");
      }
    });
  }, SAVE_INTERVAL);
}

/**
 * Stops the crawl loop. This internal function does not accept a callback and should not
 * be called by external services.
 */
function _stop(callback) {
  if (callback === undefined) {
    throw new Error("Stop crawl received no callback");
  }
  stopped = true;
  clearInterval(module.exports._crawlInterval);
  setTimeout(() => {
    clearInterval(module.exports._saveInterval);
  }, SAVE_INTERVAL + 1000);
  callback(null, null);
}

/**
 * Crawls a url, then adds the page to index queue.
 * @param {string} url
 * @param {Callback} [callback]
 * @return {void}
 */
function crawlURL(url, callback) {
  util.search.downloadPage(url, (error, htmlContent) => {
    if (error) {
      console.warn(`Error when downloading page ${url} in crawlURL`);
      // Do nothing
      callback(error, null);
      return;
    }
    // If the URL was ignored, htmlContent will be null
    if (htmlContent === null) {
      // DEBUG
      log(`Ignoring url: ${url}`, "crawl");
      global.distribution[GROUP].search.updateCrawlerStats(url, null, null, (error, result) => {
        if (error) {
          console.error(error);
        }
      });
      callback({}, {});
    } else {
      // Get page content of url and check if the page is relevant
      const {title: pageTitle, content: pageContent} = global.distribution.local.index.extractText(htmlContent);
      // DEBUG : check average page content length
      global.distribution[GROUP].search.updateCrawlerStats(null, null, pageContent.length, (error, result) => {
        if (error) {
          console.error(error);
        }
      });

      // TODO: if not relevant, should we not do anything, or still crawl the urls on the page?
      if (checkPageRelevant(url, pageTitle, pageContent)) {
        const pageURLs = util.search.extractUrls(htmlContent, url);
        if (stopped) {
          log(`Aborted crawling ${url}`, "crawl");
          callback(null, null);
          return;
        }
        // Queue up the other URLs
        global.distribution[GROUP].crawl.crawl(pageURLs, (errors, _) => {
          if (Object.keys(errors).length > 0) {
            console.error(Object.values(errors)[0]);
          }
          // Index the page
          if (CRAWL_SETTING === "index-queue") {
            // Add this page to the index queue
            global.distribution.local.index.queueUrl(url, (error, result) => {
              if (error) {
                log(`Error when indexing page: ${url}`, "crawl");
              }
              callback(error, result);
            });
          } else if (CRAWL_SETTING === "index-directly") {
            // TODO: this is copied directly from indexPage, maybe a better way to do it?

            // Just call updateIndex directly (eliminate the index queue)
            global.distribution.local.index.indexContent(url, pageTitle, pageContent, callback);
          } else {
            // Default to "isolate"
            callback(null, null);
          }
        });
        // Update the stats
        global.distribution[GROUP].search.updateCounts(1, 0, (error, result) => {
          if (error) {
            console.error(error);
          }
        });
      } else {
        // DEBUG
        log(`WARNING: page ${url} has irrelevant content`, "crawl");
        global.distribution[GROUP].search.updateCrawlerStats(null, url, null, (error, result) => {
          if (error) {
            console.error(error);
          }
        });
        callback({}, {});
      }
    }
  });
}

/**
 * Checks if a page is relevant.
 */
function checkPageRelevant(url, title, content) {
  if (content.length < 10 || content.length > MAX_PAGE_LEN) {
    return false;
  }
  return true;
}

/**
 * Given a list of URLs, add them to this node's crawl queue
 * @param {string[]} URLs
 * @param {Callback} callback
 */
function queueURLs(URLs, callback) {
  if (!Array.isArray(URLs)) {
    callback(new Error("crawler queueURLs must take in an array"));
    return;
  }
  // Normalize URLs just in case
  const normalizedURLs = URLs.map((url) => util.search.normalizeUrl(url));
  // Filter out URLs that are already crawled or in the queue
  global.distribution.local.atomicStore.getAndModify(QUEUE_KEY, {
    modify: (queue) => {
      updateQueue(queue, normalizedURLs);
      return {value: queue};
    },
    default: () => {
      const queue = {
        urls: [],
        domains: {},
      };
      updateQueue(queue, normalizedURLs);
      return {value: queue};
    },
    callback: (error, result) => {
      callback(error, null);
    },
  });
}

/**
 * Adds URLs to the queue and seen list.
 */
function updateQueue(queue, urls) {
  for (const url of urls) {
    if (SEEN_URLS.has(url)) {
      continue;
    }
    const domain = getDomain(url);
    if (queue.urls.length < MAX_QUEUE_LEN || !(domain in queue.domains)) {
      if (queue.urls.length > MAX_QUEUE_LEN * 0.95 && (domain in queue.domains) && queue.domains[domain] > 5) {
        continue;
      }
      queue.urls.push(url);
      if (!(domain in queue.domains)) {
        queue.domains[domain] = 0;
      }
      queue.domains[domain] += 1;
      SEEN_URLS.add(url);
    }
  }
}

/**
 * Returns the base domain of a URL.
 */
function getDomain(url) {
  try {
    return new URL(url).host.split(".").slice(-2).join(".");
  } catch {
    return "";
  }
}

module.exports = {queueURLs, _start, _stop};
