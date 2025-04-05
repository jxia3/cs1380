const distribution = require("./distribution.js");

distribution.node.start(() => {
  distribution.local.cachedStore.put("abcd", null, (error, result) => {
    console.log(error, result);
    distribution.local.cachedStore.get(distribution.util.id.getID("abcd"), console.log);
  });
  /* distribution.local.cachedStore.put(1, "a", () => {
    distribution.local.cachedStore.put(2, "b", () => {
      distribution.local.cachedStore.get("a", (error, result) => {
        console.log(error, result);
        distribution.local.cachedStore.get("b", (error, result) => {
          console.log(error, result);
          distribution.local.cachedStore.get("a", (error, result) => {
            console.log(error, result);
          });
        });
      });
    });
  });*/
});
