const distribution = require("./distribution.js");
const local = distribution.local;
const node = distribution.node.config;

distribution.local.comm.send([], {node, service: "status", method: "get"}, console.log);
