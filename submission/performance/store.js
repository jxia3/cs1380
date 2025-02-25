/* A script that measures the performance of storing and retrieving objects. 1,000 randomly
   generated objects are stored and retrieved from three remote nodes. to measure latency
   and throughput. */

const distribution = require("../config.js");
const random = require("./random.js");
const {generateObject} = require("./serialization.js");

const {performance} = require("perf_hooks");

const NODES = [
  {ip: "127.0.0.1", port: 2001},
  {ip: "127.0.0.1", port: 2002},
  {ip: "127.0.0.1", port: 2003},
];
const GROUP = "group";
const SERVICE = "mem";

const util = distribution.util;

if (distribution.disableLogs) {
  distribution.disableLogs();
}
random.setSeed(1000);

const nodeMap = {};
for (const node of NODES) {
  nodeMap[util.id.getSID(node)] = node;
}
const objects = [];
const keys = [];
for (let o = 0; o < 1000; o += 1) {
  const object = generateObject(3, 2);
  objects.push(object);
  keys.push(`${o}_${util.id.getID(object)}`);
}

distribution.local.groups.put(GROUP, nodeMap, (error, result) => {
  distribution[GROUP].groups.put(GROUP, nodeMap, (error, result) => {
    storeObjects(objects, keys, () => retrieveKeys(keys));
  });
});

/**
 * Stores all the objects in an array concurrently into a group of nodes.
 */
function storeObjects(objects, keys, callback) {
  let totalLatency = 0;
  const startTime = performance.now();
  let active = objects.length;

  for (let o = 0; o < objects.length; o += 1) {
    const putStart = performance.now();
    distribution[GROUP][SERVICE].put(objects[o], keys[o], (error, result) => {
      totalLatency += performance.now() - putStart;
      if (error) {
        throw error;
      }
      if (result === null) {
        throw new Error("Incorrect put result");
      }
      active -= 1;
      if (active === 0) {
        endStore();
      }
    });
  }

  function endStore() {
    const totalTime = performance.now() - startTime;
    console.log("Throughput:", objects.length / totalTime);
    console.log("Average latency:", totalLatency / objects.length);
    if (callback !== undefined) {
      callback();
    }
  }
}

/**
 * Retrieves all the keys in an array concurrently from a group of nodes.
 */
function retrieveKeys(keys, callback) {
  let totalLatency = 0;
  const startTime = performance.now();
  let active = keys.length;

  for (let k = 0; k < keys.length; k += 1) {
    const getStart = performance.now();
    distribution[GROUP][SERVICE].get(keys[k], (error, result) => {
      totalLatency += performance.now() - getStart;
      if (error) {
        throw error;
      }
      if (result === null) {
        throw new Error("Incorrect get result");
      }
      active -= 1;
      if (active === 0) {
        endRetrieve();
      }
    });
  }

  function endRetrieve() {
    const totalTime = performance.now() - startTime;
    console.log("Throughput:", objects.length / totalTime);
    console.log("Average latency:", totalLatency / objects.length);
    if (callback !== undefined) {
      callback();
    }
  }
}
