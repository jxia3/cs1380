const distribution = require("./distribution.js");

distribution.node.start(() => {
  distribution.local.store.put(1, "a", () => {
    distribution.local.store.put(2, "b", () => {
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
  });
});
