/** @typedef {import("../types").Callback} Callback */

/* A service that crawls pages and saves relevant URLs. */

const util = require('../util/util.js');

// Key for saving visited URLs on local.store
const CRAWL_KEY = "crawled-urls";
const QUEUE_KEY = "crawl-queue";
// How many pages a single node can crawl at once
const ACTIVE_LIMIT = 10;
let active = 0;
// How often we write visited URLs list to disk (per SAVE_INTERVAL URLs)
const SAVE_INTERVAL = 1000;
const crawledURLs = new Set();

/**
 * Searches for a URL in queue to crawl, extracts other URLs to crawl, then indexes the page.
 * @param {Callback} [callback]
 * @return {void}
 */
function crawl(callback) {
  // Maximum crawlers reached, don't start a new crawler
  if (active > ACTIVE_LIMIT) {
    return; // TODO: callback?
  }

  // Find first unseen URL in the queue
  checkQueue((error, URL) => {
    if (error) {
      callback(error);
      return;
    }
    if (!URL) {
      callback(new Error("currently no URLs to crawl")); // TODO: might not need an error message
      return;
    }

    // Found a URL, so get page content and page URLs
    active++;
    util.search.downloadPage(URL, (error, pageContent) => {
      if (error) {
        callback(error);
        active--;
        return;
      }
      // TODO: first do preliminary check on whether the page is relevant (ex: look for chocolate)
      const pageURLs = util.search.extractUrls(pageContent);
      queueURLs(pageURLs, )
    });
  })

  // Routinely cache the visited URLs to disk (TODO: this is not in the right place rn)
  // if (crawledURLs.size % SAVE_INTERVAL === 0) {
  //   const crawledList = Array.from(crawledURLs);
  //   global.distrbution.local.store.put(crawledList, CRAWL_KEY, (error, _) => {
  //     ...
  //   })
  // }
}

/**
 * Pops URLs from queue, calls the callback with first unseen URL or null if none found.
 * @param {Callback} callback 
 * @returns {void}
 */
function checkQueue(callback) {
  callback = callback === undefined ? (error, result) => {} : callback;
  global.distribution.local.atomicStore.getAndModify(QUEUE_KEY, {
    modify: (queue) => {
      let newURL;
      while (queue.length > 0) {
        const url = queue.shift();
        // Check if unseen
        if (!crawledURLs.has(url)) {
          newURL = url;
          crawledURLs.add(url);
          break;
        }
      }
      return {
        value: queue,
        carry: newURL,
      };
    },
    default: () => ({
      value: []
    }),
    callback: (error, result) => {
      if (error) {
        // Custom error message for debug
        callback(new Error("error when reading from crawl queue"));
      } else {
        callback(null, result);
      }
    }
  });
}

/**
 * Given a list of URLs, queue them up by using all.crawler
 * @param {string[]} URLs 
 * @param {Callback} callback 
 */
function queueURLs(URLs, callback) {
  let processed = 0;
  for (const URL of URLs) {
    global.distribution[gid].crawler.crawl(URL, (error, result) => { // TODO: HAVE TO CREATE CRAWL GROUP
      processed++;
      if (error) {
        console.warn(`failed to queue URL ${URL}: ${error.message}`);
      }
      if (processed === URLs.length) {
        callback();
      }
    });
  }
}

module.exports = {crawl};