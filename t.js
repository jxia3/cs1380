const distribution = require("./distribution.js");

distribution.node.start(() => {
  distribution.local.index._start();
  setTimeout(() => {
    distribution.local.index.queuePage("https://example.com", () => {
      distribution.local.index.queuePage("https://b.com", () => {});
    });
  }, 3000);
});
