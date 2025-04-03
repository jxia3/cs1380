/** @typedef {import("../types").Callback} Callback */

/* A service that crawls pages and saves relevant URLs. */

const util = require('../util/util.js');

// Key for saving visited URLs on local.store
const CRAWL_KEY = "crawled-urls";
// How often we write visited URLs list to disk (per SAVE_INTERVAL URLs)
const SAVE_INTERVAL = 1000;
const crawledURLs = new Set();

/**
 * Given a page URL, finds other URLs in the page to crawl, then indexes the page.
 * @param {string} pageURL
 * @param {Callback} [callback]
 * @return {void}
 */
function crawl(pageURL, callback) {
  if (crawledURLs.has(pageURL)) {
    // Already visited the URL
    callback(null, null); // TODO: callback something
    return;
  }
  crawledURLs.add(pageURL);

  // Extract page content & URLs

  // Routinely cache the visited URLs to disk
  if (crawledURLs.size % SAVE_INTERVAL === 0) {
    const crawledList = Array.from(crawledURLs);
    global.distrbution.local.store.put(crawledList, CRAWL_KEY, (error, _) => {
      if (error instanceof Error) {
        callback(error);
        return;
      }
      
    })
    
    // Technically just a put() call?
    // global.distribution.local.atomicStore.getAndModify(CRAWL_KEY, {
    //   modify: (_) => ({
    //     value: Array.from(crawledURLs)
    //   }),
    //   default: () => { // If CRAWL_KEY doesn't exist, create initial list
    //     return {
    //       value: [pageURL],
    //       carry: true
    //     }
    //   },
    //   callback: (error, result) => {
    //     // Have to check if we actually modified or not (ie if the URL was not in the list)
        
    //   },
    // });
  }
  
  // 2. If not, extract page content & URLs

  // 3. For each URL, call all.crawler on it

  // 4. Call index with the page content
}

module.exports = {crawl};