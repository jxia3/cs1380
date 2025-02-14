/* A script that measures the performance of spawning nodes. All nodes are spawned
   on localhost and with sequential ports. */

const distribution = require("../config.js");

const childProcess = require("child_process");
const {performance} = require("perf_hooks");

const LOCAL_IP = "127.0.0.1";
const BASE_PORT = 2000;

if (distribution.disableLogs) {
  distribution.disableLogs();
}

const local = distribution.local;
const node = distribution.node;

/**
 * Spawns nodes concurrently starting from a port number.
 */
function spawnNodes(count, callback) {
  let totalLatency = null;
  let startTime = null;
  const nodes = [];
  node.start(() => {
    totalLatency = 0;
    startTime = performance.now();
    startSpawn();
  });

  function startSpawn() {
    for (let n = 0; n < count; n += 1) {
      const spawnStart = performance.now();
      const port = BASE_PORT + n;
      local.status.spawn({ip: LOCAL_IP, port, _disableLogs: true}, (error, result) => {
        totalLatency += performance.now() - spawnStart;
        if (error) {
          throw error;
        }
        if (result.ip !== LOCAL_IP || result.port !== port) {
          throw new Error("Incorrect IP or port");
        }
        nodes.push(result);
        if (nodes.length === count) {
          endSpawn();
        }
      });
    }
  }

  function endSpawn() {
    const totalTime = performance.now() - startTime;
    console.log("Throughput:", count / totalTime);
    console.log("Average latency:", totalLatency / count);
    callback(nodes);
    childProcess.exec("pkill node");
  }
}

if (require.main === module) {
  console.log("Spawning 100 nodes");
  spawnNodes(100, (nodes) => {
    console.log("Test ended");
  });
}

module.exports = {LOCAL_IP, BASE_PORT, spawnNodes};
