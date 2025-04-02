/** @typedef {import("../types").Callback} Callback */

/* A service that crawls pages and saves relevant URLs. */

// Key for saving visited URLs on local.store
const CRAWL_KEY = "crawled-urls";

/**
 * Given a page URL, finds other URLs in the page to crawl, then indexes the page.
 * @param {string} pageURL
 * @param {Callback} [callback]
 * @return {void}
 */
function crawl(pageURL, callback) {
  // 1. Check local.store to see if this URL has been visited (do I need locking here?)
  global.distribution.local.atomicStore.getAndModify(CRAWL_KEY, {
    modify: (urlList) => {
      // Only return results if this URL is not seen
      if (!urlList.includes(pageURL)) {
        return {
          value: [...urlList, pageURL],
          carry: true
        }
      }
    },
    default: () => { // If CRAWL_KEY doesn't exist, create initial list
      return {
        value: [pageURL],
        carry: true
      }
    },
    callback: (error, result) => {
      // Have to check if we actually modified or not (ie if the URL was not in the list)
      
    },
  });
  
  // 2. If not, extract page content & URLs

  // 3. For each URL, call all.crawler on it

  // 4. Call index with the page content
}

module.exports = {crawl};