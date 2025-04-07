const distribution = require("./distribution.js");

const RESET = true;

distribution.node.start(() => {
  distribution.local.groups.put("search", [distribution.node.config], () => {
    distribution.local.crawl._start(RESET, () => {
      distribution.local.index._start(RESET, () => {
        setTimeout(() => {
          distribution.local.crawl.queueURLs(["https://www.nba.com"], () => {});
        }, 1000);
      });
    });
  });
});
