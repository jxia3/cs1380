const distribution = require("./distribution.js");

const RESET = true;

distribution.node.start(() => {
  distribution.local.groups.put("search", [distribution.node.config], () => {
    console.log("added search group");
    // This only tests crawler, use the code block below instead for crawler + index
    // distribution.local.crawler._start(RESET, () => {
    //   setTimeout(() => {
    //     distribution.local.crawler.queueURLs(["https://www.nba.com/"], () => {});
    //   }, 1000);
    // });


    // TODO: should resetCrawler in crawler and clearQueue in index always be same?
    distribution.local.crawler._start(RESET, () => {
      distribution.local.index._start(RESET, () => {
        setTimeout(() => {
          distribution.local.crawler.queueURLs(["https://www.nba.com/"], () => {});
        }, 1000);
      });
    });
  });
});

// distribution.util.search.downloadPage("https://www.nba.com/", (error, content) => {
//   const URLs = distribution.util.search.extractUrls(content, "https://www.nba.com/");
//   console.log(URLs.length);
// });
