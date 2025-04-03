const distribution = require("./distribution.js");

distribution.node.start(() => {
  distribution.local.groups.put("search", [distribution.node.config], () => {
    console.log("added search group");
    distribution.local.index._start(true, () => {
      setTimeout(() => {
        distribution.local.index.queueUrl("https://cs.brown.edu/courses/csci1380/sandbox/1/", () => {});
      }, 1000);
    });
  });
});
