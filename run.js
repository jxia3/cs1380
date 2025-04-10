const distribution = require("./distribution.js");

const GROUP = distribution.searchParams.searchGroup;
const RESET = true;

const localNode = {
  ip: distribution.node.config.ip,
  port: distribution.node.config.port,
};
const nodes = [localNode];
const urls = ["https://deepmind.google"];
let startTime;

if (require.main === module) {
  if (process.argv[2] === "clear") {
    clear();
  } else if (process.argv[2] === "download") {
    download();
  } else {
    console.log("Unknown command");
  }
}

function clear() {
  startLocal(() => {
    for (const node of nodes) {
      const remote = {node, service: "store", method: "clear"};
      distribution.local.comm.send(["local"], remote, (error, result) => {
        if (error) {
          console.error(error);
        } else {
          console.log("Cleared", node);
        }
      });
    }
  });
}

function download() {
  startGroup(() => {
    distribution[GROUP].search.start(localNode, RESET, (error, result) => {
      if (Object.keys(error).length > 0) {
        throw error;
      }
      setTimeout(() => {
        startTime = performance.now();
        distribution[GROUP].crawl.crawl(urls, (error, result) => {
          if (Object.keys(error).length > 0) {
            throw error;
          }
        });
      }, 1000);
    });
  });
  handleSignals();
}

function startLocal(callback) {
  distribution.node.start(() => {
    distribution.local.groups.put(GROUP, nodes, (error, result) => {
      if (error) {
        throw error;
      }
    });
    callback();
  });
}

function startGroup(callback) {
  startLocal(() => {
    distribution[GROUP].groups.put(GROUP, nodes, (error, result) => {
      if (Object.keys(error).length > 0) {
        throw error;
      }
      callback();
    });
  });
}

function handleSignals() {
  process.on("SIGQUIT", () => {
    console.log();
    printStats();
  });

  process.on("SIGINT", () => {
    console.log();
    try {
      distribution[GROUP].search.stop((error, result) => {
        console.log("Stop:", error, result);
        setTimeout(() => {
          try {
            distribution[GROUP].search.flushCache((error, result) => {
              console.log("Flush:", error, result);
              process.exit(0);
            });
          } catch (error) {
            console.error(error);
            process.exit(1);
          }
        }, 1000);
        printStats();
      });
    } catch (error) {
      console.error(error);
      process.exit(1);
    }
  });
}

function printStats() {
  console.log(`Time elapsed: ${(performance.now() - startTime) / 1000} seconds`);
  distribution.local.search.getCounts(console.log);
  distribution.local.search.getCrawlStats(console.log);
}

module.exports = {distribution, startLocal};
