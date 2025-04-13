module.exports = {
  searchGroup: "search",
  indexQueue: "index-queue",
  crawlQueue: "crawl-queue",
  crawlSeen: "crawl-seen",
  crawlSetting: "index-directly", // "isolate", "index-queue", "index-directly" (TODO: maybe add enum)

  ngramLen: 2,
  maxQueueLen: 5000,
  maxPageLen: 100_000,
  shardCount: 20_000,
  shardLocality: false,
  fifoCache: false,
  disableTermCache: false,
  enableQuery: true,
  disableShardCache: false,

  deployment: false,
  debug: false,
  notFoundMark: "_not_found_97189983cb4254d7",
};
