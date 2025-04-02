/** @typedef {import("../types").Callback} Callback */

/* A service that crawls pages and saves relevant URLs. */

/**
 * Sends a message to call a service on a remote node.
 * @param {string} pageURL
 * @param {Callback} [callback]
 * @return {void}
 */
function crawl(pageURL, callback) {
  // 1. Check local.store to see if this URL has been visited
  
  // 2. If not, extract page content & URLs

  // 3. For each URL, call all.crawler on it

  // 4. Call index with the page content
}

module.exports = {crawl};