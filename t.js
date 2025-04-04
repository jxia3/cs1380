const distribution = require("./distribution.js");

distribution.node.start(() => {
  distribution.local.groups.put("search", [distribution.node.config], () => {
    console.log("added search group");
    distribution.local.crawler._start(true, false, () => {
      setTimeout(() => {
        distribution.local.crawler.queueURLs(["https://www.nba.com/"], () => {});
      }, 1000);
    });
  });
});

// distribution.util.search.downloadPage("https://www.nba.com/", (error, content) => {
//   const URLs = distribution.util.search.extractUrls(content, "https://www.nba.com/");
//   console.log(URLs.length);
// });
