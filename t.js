const distribution = require("./distribution.js");
global.nodeConfig.heartbeat = true;

const basePort = 2000;
const nodes = [
  {ip: "127.0.0.1", port: basePort, heartbeat: true},
  // {ip: "127.0.0.1", port: basePort + 1, heartbeat: true},
  // {ip: "127.0.0.1", port: basePort + 2, heartbeat: true},
];

distribution.node.start(() => {
  runTest();
});

function runTest() {
  distribution.local.groups.put("test", [global.nodeConfig, ...nodes], (error, result) => {
    console.log("local put result", error, result);
    distribution.all.groups.put("test", [global.nodeConfig, ...nodes], (error, result) => {
      console.log("all put result", error, result);
    });
  });
}
