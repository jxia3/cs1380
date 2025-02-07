const distribution = require("./distribution.js");
const node = distribution.node.config;
const util = distribution.util;

function add(a, b, callback) {
  callback(a + b);
}

const result = util.wire.createRPC(add);
console.log(node);
console.log(result);
console.log(result.toString());
