const distribution = require("./distribution.js");
const node = distribution.node.config;
const util = distribution.util;

function add(a, b, callback) {
  callback(a + b);
}

util.comm.send();

result(1, 2, console.log);
result(2, 3, console.log);
