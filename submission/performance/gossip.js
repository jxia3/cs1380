/* A script that measures the convergence of gossip under different broadcast
   parameters. A fixed-size node group of 100 nodes is used. */

const distribution = require("../config.js");
const spawn = require("./spawn.js");

if (distribution.disableLogs) {
  distribution.disableLogs();
}

const util = distribution.util;

spawn.spawnNodes(100, (nodes, exit) => {
  let count = 0;
  function increment(callback) {
    count += 1;
    callback(null, count);
  }
  const counterService = {increment: util.wire.createRPC(increment)};
  const group = {gid: "gossip", subset: (l) => 6};

  distribution.local.routes.put(counterService, "counter", (error, result) => {
    distribution.local.groups.put(group, nodes, (error, result) => {
      distribution.gossip.groups.put(group, nodes, (error, result) => {
        const service = {service: "comm", method: "send"};
        const args = [[], {node: global.nodeConfig, service: "counter", method: "increment"}];
        distribution.gossip.gossip.send(args, service, (error, result) => {
          const counts = [];
          for (const delay of [10, 50, 100, 200, 300, 400, 500, 1000]) {
            setTimeout(() => {
              counts.push([delay, count]);
            }, delay);
          }
          setTimeout(() => {
            console.log(counts);
            console.log(count);
            exit();
          }, 5000);
        });
      });
    });
  });
});
