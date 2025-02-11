const d = require("./distribution.js");
const bd = require("@brown-ds/distribution");

d.node.start(() => {
  d.local.comm.send(["nid"], {node: d.node.config, service: "status", method: "get"}, console.log);
});
