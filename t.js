const distribution = require("./distribution.js");

const cache = distribution.util.cache.createCache(3);
console.log(cache.getKeys());
cache.put("a", 1);
console.log(cache.getKeys());
cache.put("b", 2);
console.log(cache.getKeys());
cache.put("c", 3);
console.log(cache.getKeys());
cache.put("d", 4);
console.log(cache.getKeys());
console.log(cache.get("c"));
console.log(cache.getKeys());

/* distribution.node.start(() => {
  distribution.local.groups.put("search", [distribution.node.config], () => {
    console.log("added search group");
    distribution.local.index._start(true, () => {
      setTimeout(() => {
        distribution.local.index.queueUrl("https://stripe.com", () => {});
      }, 1000);
    });
  });
});*/
