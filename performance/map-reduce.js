/* A script that measures the performance of MapReduce. A trivial workload is
   used to only measure the overhead of the framework. */

const distribution = require("../config.js");
const spawn = require("./spawn.js");

const {performance} = require("perf_hooks");

if (distribution.disableLogs) {
  distribution.disableLogs();
}

const util = distribution.util;

const dataset = [];
for (let id = 0; id < 1000; id += 1) {
  dataset.push({[id.toString()]: id.toString().repeat(100)});
}

function createDataset(group, callback) {
  let active = dataset.length;
  for (const item of dataset) {
    const key = Object.keys(item)[0];
    distribution[group].store.put(item[key], key, (error, result) => {
      active -= 1;
      if (active === 0) {
        callback();
      }
    });
  }
}

const identityConfig = {
  keys: dataset.flatMap((i) => Object.keys(i)),
  map: (key, value) => ({[key]: value}),
  reduce: (key, values) => ({[key]: values}),
};

spawn.spawnNodes(10, (nodes, exit) => {
  const group = {gid: "mapReduce", hash: util.id.consistentHash};
  distribution.local.groups.put(group, nodes, (error, result) => {
    distribution.mapReduce.groups.put(group, nodes, (error, result) => {
      createDataset(group.gid, () => {
        const start = performance.now();
        distribution.mapReduce.mr.exec(identityConfig, (error, result) => {
          const time = performance.now() - start;
          if (error) {
            console.error(error);
            exit();
            return;
          }
          console.log("Throughput:", identityConfig.keys.length / time);
          console.log("Latency:", time / identityConfig.keys.length);
          exit();
        });
      });
    });
  });
});
