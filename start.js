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

process.on("SIGQUIT", () => {
  distribution.local.search.getCounts(console.log);
});

process.on("SIGINT", () => {
  try {
    distribution[GROUP].search.stop((error, result) => {
      console.log("stop:", error, result);
      setTimeout(() => {
        try {
          distribution[GROUP].search.flushCache((error, result) => {
            console.log("flush:", error, result);
            process.exit(0);
          });
        } catch (error) {
          console.error(error);
          process.exit(1);
        }
      }, 1000);
    });
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
});
