/** @typedef {import("../types").Callback} Callback */

/* A service that crawls pages and saves relevant URLs. */

const log = require("../util/log.js");
const params = require("../params.js");
const util = require("../util/util.js");

const GROUP = params.searchGroup;
const SEEN_KEY = params.crawlSeen;
const QUEUE_KEY = params.crawlQueue;
// How many pages a single node can crawl at once
const ACTIVE_LIMIT = 3;
// How often we write visited URLs list to disk (ms)
const SAVE_INTERVAL = 5000;
const CRAWL_INTERVAL = 500;

// IMPORTANT: we consider a URL as seen if crawled OR if it's currently in the queue
const SEEN_URLS = new Set();

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

  if (resetCrawler) {
    log("Resetting crawl queue and seen URLs list", "crawl");
    // TODO: will this have race conditions or don't have to worry about that?
    global.distribution.local.store.put([], SEEN_KEY, (error, result) => {
      global.distribution.local.store.put([], QUEUE_KEY, callback);
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
          log(`Crawling url: ${url}`, "crawl");
          crawlURL(url, (errors, _) => {
            if (Object.keys(errors).length > 0) {
              console.error(Object.values(errors)[0]);
            }
            // Add this page to the index queue
            // TODO: instead of queuing it, just call indexPage (can eliminate the index queue)
            global.distribution.local.index.queueUrl(url, (error, result) => {
              if (error) {
                console.error(`failed to add ${url} to index queue after crawling`);
              }
              // Done
              active -= 1;
            });
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
 * Crawls a URL, then adds the page to index queue.
 * @param {string} URL
 * @param {Callback} [callback]
 * @return {void}
 */
function crawlURL(URL, callback) {
  util.search.downloadPage(URL, (error, pageContent) => {
    if (error) {
      console.warn(`Error when downloading page ${URL} in crawlURL`);
      // Do nothing
      callback({}, {});
      return;
    }
    // TODO: first do preliminary check on whether the page is relevant (ex: look for chocolate)
    // - can call extractText on pageContent, and search within that

    // TODO: (lower priority) give the indexer the pagecontent directly instead of the URL
    const pageURLs = util.search.extractUrls(pageContent, URL);
    global.distribution[GROUP].crawl.crawl(pageURLs, callback);
  });
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
  const newURLs = normalizedURLs.filter((url) => {
    if (!SEEN_URLS.has(url)) {
      SEEN_URLS.add(url);
      return true;
    }
    return false;
  });
  global.distribution.local.atomicStore.getAndModify(QUEUE_KEY, {
    modify: (queue) => {
      return {
        value: queue.concat(newURLs),
      };
    },
    default: () => {
      return {
        value: newURLs,
      };
    },
    callback: (error, result) => {
      callback(error, null);
    },
  });
}

module.exports = {queueURLs, _start};
