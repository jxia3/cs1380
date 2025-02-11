const d1 = require("./distribution.js");
const d2 = require("@brown-ds/distribution");

global.distribution = d2;
const distribution = d2;

const basePort = 2000;
const nodes = [
  {ip: "127.0.0.1", port: basePort},
  {ip: "127.0.0.1", port: basePort + 1},
  {ip: "127.0.0.1", port: basePort + 2},
];

distribution.node.start(() => {
  distribution.local.status.spawn(nodes[0], (error, result) => {
    console.log("spawned first node");
    distribution.local.status.spawn(nodes[1], (error, result) => {
      console.log("spawned second node");
      distribution.local.status.spawn(nodes[2], (error, result) => {
        console.log("spawned third node");
        runTest();
      });
    });
  });
});

function runTest() {
  const group = {};
  for (const node of nodes) {
    group[distribution.util.id.getSID(node)] = node;
  }
  console.log("adding group", group);
  distribution.local.groups.put("test", group, (error, result) => {
    console.log(error, result);
    distribution.test.status.get(["sid"], console.log);
  });
}
