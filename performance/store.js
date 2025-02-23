/* A script that measures the performance of storing and retrieving objects. 1,000 randomly
   generated objects are stored and retrieved from three remote nodes. to measure latency
   and throughput. */

const distribution = require("../config.js");
const random = require("./random.js");
const {generateObject} = require("./serialization.js");

const {performance} = require("perf_hooks");

const GROUP = "group";
const NODES = [
  {ip: "127.0.0.1", port: 2001},
  {ip: "127.0.0.1", port: 2002},
  {ip: "127.0.0.1", port: 2003},
];

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
for (let o = 0; o < 1000; o += 1) {
  objects.push(generateObject(3, 2));
}

distribution.local.groups.put(GROUP, nodeMap, (error, result) => {
  distribution[GROUP].groups.put(GROUP, nodeMap, (error, result) => {
    storeObjects(objects, retrieveKeys);
  })
})

/**
 * Stores all the objects in an array concurrently into a group of nodes.
 */
function storeObjects(objects, callback) {
  console.log("storing objects", objects.length);
}

/**
 * Retrieves all the keys in an array concurrently from a group of nodes.
 */
function retrieveKeys(keys, callback) {
  console.log("retrieving keys", keys.length);
}
