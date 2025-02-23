/* A script that measures the performance of storing and retrieving objects. 1,000 randomly
   generated objects are stored and retrieved from three remote nodes. to measure latency
   and throughput. */

const distribution = require("../config.js");
const random = require("./random.js");
const {generateObject} = require("./serialization.js");

const {performance} = require("perf_hooks");

const NODES = [
  {ip: "", port: 0},
  {ip: "", port: 0},
  {ip: "", port: 0},
];

if (distribution.disableLogs) {
  distribution.disableLogs();
}

random.setSeed(1000);
const objects = [];
for (let o = 0; o < 1000; o += 1) {
  objects.push(generateObject(3, 2));
}
storeObjects(objects, retrieveObjects);

function storeObjects(objects, callback) {

}

function retrieveObjects(objects, callback) {

}
