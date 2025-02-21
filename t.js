const d1 = require("./distribution.js");
const d2 = require("@brown-ds/distribution");

global.distribution = d1;
const distribution = d1;

const basePort = 2000;
const nodes = [
  {ip: "127.0.0.1", port: basePort},
  {ip: "127.0.0.1", port: basePort + 1},
  {ip: "127.0.0.1", port: basePort + 2},
];

distribution.node.start(() => {
  distribution.local.status.spawn(nodes[0], (error, result) => {
    console.log("spawned first node", result);
    distribution.local.status.spawn(nodes[1], (error, result) => {
      console.log("spawned second node", result);
      distribution.local.status.spawn(nodes[2], (error, result) => {
        console.log("spawned third node", result);
        runTest();
      });
    });
  });
});

function runTest() {
  const id = distribution.util.id;
  const hash = id.getID({a: "b"});
  distribution.local.store.get(null, console.log);
}
