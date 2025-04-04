/** @typedef {import("../types").Callback} Callback */

/* A service that crawls pages and saves relevant URLs. */

const util = require("../util/util.js");

const GROUP = util.search.GROUP;
const SEEN_KEY = "seen-urls";
const QUEUE_KEY = "crawl-queue";
// How many pages a single node can crawl at once
const ACTIVE_LIMIT = 10;
// How often we write visited URLs list to disk (ms)
const SAVE_INTERVAL = 5000;
const CRAWL_INTERVAL = 5000;

// Consider URL as seen if crawled OR if it is currently in the queue (TODO: is this best way?)
const seenURLs = new Set();

/**
 * Initializes the queue and starts the crawl loop. This internal function does not accept a callback
 * and should not be called by external services.
 * @param {boolean} clearQueue
 * @param {boolean} clearSeen
 * @param {Callback} callback
 */
function _start(clearQueue, clearSeen, callback) {
  if (callback === undefined) {
    throw new Error("Start index received no callback");
  }
  if (clearQueue) {
    global.distribution.local.store.put([], QUEUE_KEY, callback);
  } else {
    global.distribution.local.store.tryGet(QUEUE_KEY, (error, exists, result) => {
      if (error) {
        callback(new Error("couldn't retrieve crawler queue on _start"), null);
      } else if (exists) {
        callback(null, null);
      } else {
        global.distribution.local.store.put([], QUEUE_KEY, callback);
      }
    });
  }
  // TODO: sync up local seenURLs with stored seenURLs
  let active = 0;
  // Periodically check for new pages on the queue to crawl
  module.exports._crawlInterval = setInterval(() => {
    if (active > ACTIVE_LIMIT) {
      return;
    }
    active += 1;
    global.distribution.local.atomicStore.getAndModify(QUEUE_KEY, {
      modify: (queue) => {
        // Get the first unseen URL from queue if it exists
        let newURL = null;
        while (queue.length > 0) {
          const url = queue.shift();
          // Check if unseen
          if (!seenURLs.has(url)) {
            newURL = url;
            seenURLs.add(url);
            break;
          }
        }
        return {
          value: queue,
          carry: newURL,
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
          console.log(`crawling url: ${url}`);
          crawlURL(url, (errors, _) => {
            if (Object.keys(errors).length > 0) {
              console.error(Object.values(errors)[0]);
            }
            // Add this page to the index queue
            console.log(`adding url to index queue: ${url}`);
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
    console.log(`saving seenURLs set to disk...`);
    const seenList = Array.from(seenURLs);
    global.distribution.local.store.put(seenList, SEEN_KEY, (error, _) => {
      if (error) {
        console.warn("failed to save seenURLs set to disk");
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
      console.warn(`error when downloading page ${URL} in crawlURL`);
      callback(null, null);
      return;
    }
    // TODO: first do preliminary check on whether the page is relevant (ex: look for chocolate)
    const pageURLs = util.search.extractUrls(pageContent, URL);
    console.log(`found ${pageURLs.length} URLs to crawl in page ${URL}`)
    global.distribution[GROUP].crawler.crawl(pageURLs, callback);
  });
}

/**
 * Given a list of URLs, add them to this node's crawl queue
 * @param {string[]} URLs
 * @param {Callback} callback
 */
function queueURLs(URLs, callback) {
  if (!Array.isArray(URLs)) {
    callback(new Error('crawler queueURLs must take in an array'));
    return;
  }
  // Filter out URLs that are already crawled or in the queue
  const newURLs = URLs.filter(url => !seenURLs.has(url));
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
