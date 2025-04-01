/* A service that indexes pages and manages the global search index. */

const log = require("../util/log.js");
const util = require("../util/util.js");

const QUEUE_KEY = "index-queue";

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
        if (error || queue.length == 0) {
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
  callback = callback === undefined ? (error, result) => {} : callback;
  util.search.downloadPage(url, (error, content) => {
    if (error) {
      callback(error, null);
      return;
    }
    console.log("got content", content);
  });
}

module.exports = {queuePage, _start};
