/* A script that measures the performance of spawning nodes. All nodes are spawned
   on localhost and with sequential ports. */

const distribution = require("../config.js");

const {performance} = require("perf_hooks");

const LOCAL_IP = "127.0.0.1";
const BASE_PORT = 2000;

if (distribution.disableLogs) {
  distribution.disableLogs();
}

const local = distribution.local;

/**
 * Spawns nodes sequentially starting from a port number.
 */
function spawnNodes(count, callback) {
  let totalLatency = 0;
  const startTime = performance.now();
  spawn(count);

  function spawn(iter) {
    if (iter === 0) {
      callback();
      return;
    }
    const spawnStart = performance.now();
    const port = BASE_PORT + count - iter;
    local.status.spawn({ ip: LOCAL_IP, port }, (error, result) => {
      if (error) {
        throw error;
      }
      if (result.ip !== LOCAL_IP || result.port !== port) {
        throw new Error("Incorrect IP or port");
      }
    })
  }
}

module.exports = {spawnNodes};
