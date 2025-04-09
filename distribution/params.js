module.exports = {
  searchGroup: "search",
  ngramLen: 2,
  indexQueue: "index-queue",
  crawlQueue: "crawl-queue",
  crawlSeen: "crawl-seen",
  crawlSetting: "isolate", // "isolate", "index-queue", "index-directly" (TODO: maybe add enum)
  notFoundMark: "_not_found_97189983cb4254d7",
  pageRelevant: (pageContent) => {
    // Returns true if the page is relevant to our search engine based on some metric
    return pageContent.toLowerCase().includes('google')
  }
};
