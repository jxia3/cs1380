const distribution = require("./distribution.js");
const node = distribution.node.config;
const util = distribution.util;

function add(a, b, callback) {
  callback(a + b);
}

distribution.local.comm.send([add], {
  node,
  service: "rpc",
  method: "create",
}, (error, result) => {
  console.log(error, result);
  console.log(result.toString());
  result(1, 2, console.log);
  result(2, 3, console.log);
});
