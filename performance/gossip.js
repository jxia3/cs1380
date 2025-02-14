/* A script that measures the convergence of gossip under different broadcast
   parameters. A fixed-size node group of 50 nodes is used. */

const distribution = require("../config.js");
const spawn = require("./spawn.js");

if (distribution.disableLogs) {
  distribution.disableLogs();
}

const local = distribution.local;

spawn.spawnNodes(10, (nodes) => {
  console.log(nodes);
});
