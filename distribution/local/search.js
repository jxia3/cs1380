/* A service that coordinates crawling and indexing. */

const log = require("../util/log.js");

const counts = {
  crawled: 0,
  indexed: 0,
};

/**
 * Starts the local crawler and indexer processing queues.
 */
function start(reset, callback) {
  log("Starting crawl and index cycle");
  global.distribution.local.crawl._start(reset, (error, result) => {
    if (error) {
      callback(error, null);
      return;
    }
    global.distribution.local.index._start(reset, (error, result) => {
      if (error) {
        callback(error, null);
      } else {
        callback(null, null);
      }
    });
  });
}

/**
 * Stops the local crawler and indexer processing queues.
 */
function stop(callback) {
  log("Stopping crawl and index cycle");
  global.distribution.local.crawl._stop((error, result) => {
    if (error) {
      callback(error, null);
      return;
    }
    global.distribution.local.index._stop((error, result) => {
      if (error) {
        callback(error, null);
      } else {
        callback(null, null);
      }
    });
  });
}

/**
 * Flushes the local storage caches.
 */
function flushCache(callback) {
  throw new Error("cannot flush the cache");
}

/**
 * Returns the crawled and indexed count. The counts are only stored on the orchestrator node.
 */
function getCounts(callback) {
  callback(null, counts);
}

/**
 * Adds the number of pages crawled and indexed to the orchestrator counts.
 */
function updateCounts(crawled, indexed, callback) {
  counts.crawled += crawled;
  counts.indexed += indexed;
  callback(null, null);
}

module.exports = {start, stop, flushCache, getCounts, updateCounts};
