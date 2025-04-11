module.exports = {
  searchGroup: "search",
  ngramLen: 2,
  indexQueue: "index-queue",
  crawlQueue: "crawl-queue",
  crawlSeen: "crawl-seen",
  crawlSetting: "index-directly", // "isolate", "index-queue", "index-directly" (TODO: maybe add enum)
  notFoundMark: "_not_found_97189983cb4254d7",
  pageRelevant: (pageContent) => {
    if (pageContent.length < 10) {
      return false;
    }
    return true;
    // Returns true if the page is relevant to our search engine based on some metric
    // return pageContent.toLowerCase().includes("google");
  },
  shardLocality: false,
  fifoCache: false,
  disableCache: false,
  enableQuery: true,
  debug: true,
};
