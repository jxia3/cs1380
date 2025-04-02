const distribution = require("./distribution.js");

distribution.node.start(() => {
  distribution.local.index._start(true, () => {
    setTimeout(() => {
      distribution.local.index.queuePage("https://stripe.com", () => {});
    }, 1000);
  });
});
