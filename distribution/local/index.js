/* A service that indexes pages and manages the global search index. */

const log = require("../util/log.js");
const util = require("../util/util.js");

const queueMutex = util.sync.createMutex();

/**
 * Adds a URL to the indexing queue.
 */
function indexPage(url, callback) {
  queueMutex.lock(() => {
    log(`Adding page ${url} to the index queue`);
    global.distribution.local.store.get("index-queue", (error, queue) => {
      if (error) {
        queue = [url];
      } else {
        queue.push(url);
      }
      global.distribution.local.store.put(queue, "index-queue", (error, result) => {
        queueMutex.unlock(() => callback(error, result));
      });
    });
  });
}

module.exports = {indexPage};
