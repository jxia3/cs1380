const distribution = require("./distribution.js");

distribution.node.start(() => {
  distribution.local.index.indexPage("https://example.com", () => {
    distribution.local.index.indexPage("https://b.com", () => {
      console.log("added pages");
    });
  });
});
