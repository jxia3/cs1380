const distribution = require("./distribution.js");

distribution.node.start(() => {
  distribution.local.index._start();
  setTimeout(() => {
    distribution.local.index.queuePage("https://en.wikipedia.org/wiki/List_of_public_corporations_by_market_capitalization", () => {});
  }, 1000);
});
