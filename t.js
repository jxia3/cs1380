const distribution = require("./distribution.js");

distribution.node.start(() => {
  distribution.local.groups.put("search", [distribution.node.config], () => {
    distribution.local.index._start(true, () => {
      distribution.local.index.queueUrl("https://deepmind.google", () => {
        distribution.local.index.queueUrl("https://en.wikipedia.org/wiki/Google_DeepMind", () => {
          distribution.local.index.queueUrl("https://en.wikipedia.org/wiki/OpenAI", () => {});
        });
      });
    });
  });
});
