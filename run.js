const distribution = require("./distribution.js");
const params = require("./distribution/params.js");

const fs = require("fs");

const DEPLOYMENT = params.deployment;
const GROUP = distribution.searchParams.searchGroup;
const FREQUENT_COUNT = 1000;
const FREQUENT_FILE = "data/frequent.json";
const RESET = true;

const offset = [0, 10];
// const addresses = [
//   "3.139.81.183", "3.149.2.194", "18.217.66.8", "3.15.220.99", "3.147.63.105",
//   "18.226.159.174", "18.117.185.42", "18.223.196.60", "3.139.108.222", "3.16.66.233",
// ];
const addresses = [
  "3.144.40.75", "3.149.2.194", "18.217.66.8", "3.15.220.99", "3.147.63.105",
  "18.226.159.174", "18.117.185.42", "18.223.196.60", "3.139.108.222", "3.16.66.233",
];
const nodes = addresses.slice(offset[0], offset[1]).map((n) => ({ip: n, port: 80}));

const localNode = DEPLOYMENT ? nodes[0] : global.nodeConfig;
if (DEPLOYMENT) {
  global.nodeConfig.ip = "0.0.0.0";
  global.nodeConfig.port = 80;
} else {
  nodes.length = 0;
  nodes.push(global.nodeConfig);
}

const urls = [
  // "https://deepmind.google",
  // "https://stackexchange.com",
  // "https://github.com/sindresorhus/awesome",
  // "https://github.com/StanForever/awesome-websites",
  // "https://apnews.com",
  "https://www.nba.com",
];
let startTime;

if (require.main === module) {
  const command = process.argv[2];
  if (command === "clear") {
    clear();
  } else if (command === "idle") {
    idle();
  } else if (command === "download") {
    download(nodes.length, RESET);
  } else if (command === "calc") {
    calc();
  } else {
    console.log("Unknown command");
  }
}

function clear() {
  startLocal(nodes.length, () => {
    for (const node of nodes) {
      const remote = {node, service: "store", method: "clear"};
      distribution.local.comm.send([GROUP], remote, (error, result) => {
        if (error) {
          throw error;
        }
        console.log("Cleared", node);
      });
    }
  });
}

function idle() {
  startLocal(nodes.length, () => {
    console.log("Idling");
  });
}

function download(nodeCount, reset) {
  nodeCount = Math.min(nodeCount, nodes.length);
  console.log("Downloading with", nodeCount, reset);
  startGroup(nodeCount, () => {
    distribution[GROUP].search.start(localNode, reset, (error, result) => {
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

function calc() {
  startLocal(nodes.length, () => {
    distribution[GROUP].termLookup.calcMostFrequent(FREQUENT_COUNT, (error, result) => {
      if (error) {
        throw error;
      }
      console.log(result);
      fs.writeFileSync(FREQUENT_FILE, JSON.stringify(result, null, 4));
    });
  });
}

function startLocal(nodeCount, callback) {
  distribution.node.start(() => {
    distribution.local.groups.put(GROUP, nodes.slice(0, nodeCount), (error, result) => {
      if (error) {
        throw error;
      }
    });
    callback();
  });
}

function startGroup(nodeCount, callback) {
  startLocal(nodeCount, () => {
    distribution[GROUP].groups.put(GROUP, nodes.slice(0, nodeCount), (error, result) => {
      if (Object.keys(error).length > 0) {
        throw error;
      }
      callback();
    });
  });
}

function handleSignals() {
  let exiting = false;

  process.on("SIGQUIT", () => {
    console.log();
    printStats();
  });

  process.on("SIGINT", () => {
    if (exiting) {
      console.log("Already exiting");
      return;
    }
    exiting = true;
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

module.exports = {GROUP, distribution, startLocal, startGroup, download};
