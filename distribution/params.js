module.exports = {
  searchGroup: "search",
  indexQueue: "index-queue",
  crawlQueue: "crawl-queue",
  crawlSeen: "crawl-seen",
  crawlSetting: "index-directly", // "isolate", "index-queue", "index-directly" (TODO: maybe add enum)

  ngramLen: 2,
  maxQueueLen: 20_000,
  maxPageLen: 200_000,
  shardLocality: false,
  fifoCache: false,
  disableTermCache: false,
  disableShardCache: false,

  debug: false,
  notFoundMark: "_not_found_97189983cb4254d7",
};
