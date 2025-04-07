const distribution = require("./distribution.js");

const GROUP = distribution.searchParams.searchGroup;
const RESET = true;

const localNode = {
  ip: distribution.node.config.ip,
  port: distribution.node.config.port,
};
const nodes = [localNode];
const urls = ["https://deepmind.google"];

distribution.node.start(() => {
  distribution.local.groups.put(GROUP, nodes, (error, result) => {
    if (error) {
      throw error;
    }
    distribution[GROUP].groups.put(GROUP, nodes, (error, result) => {
      if (Object.keys(error).length > 0) {
        throw error;
      }
      distribution[GROUP].search.start(localNode, RESET, (error, result) => {
        if (Object.keys(error).length > 0) {
          throw error;
        }
        setTimeout(() => {
          distribution[GROUP].crawl.crawl(urls, (error, result) => {
            if (Object.keys(error).length > 0) {
              throw error;
            }
          });
        }, 1000);
      });
    });
  });
});

process.on("SIGINT", () => {
  console.log("handling sigint");
  process.exit(0);
});
