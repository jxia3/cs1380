const distribution = require("./distribution.js");

const basePort = 2000;
const nodes = [
  {ip: "127.0.0.1", port: basePort},
  {ip: "127.0.0.1", port: basePort + 1},
  {ip: "127.0.0.1", port: basePort + 2},
];

distribution.node.start(() => {
  distribution.local.status.spawn(nodes[0], (error, result) => {
    distribution.local.status.spawn(nodes[1], (error, result) => {
      distribution.local.status.spawn(nodes[2], (error, result) => {
        runTest();
      });
    });
  });
});

function runTest() {
  distribution.local.groups.put("test", [global.nodeConfig, ...nodes], (error, result) => {
    console.log("local put result", error, result);
    distribution.all.groups.put("test", [global.nodeConfig, ...nodes], (error, result) => {
      console.log("all put result", error, result);
      console.log();
    });
  });
}
