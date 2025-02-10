const distribution = require("./distribution.js");

/*
function callback(error, result) {
  console.log(error, result);
}

distribution.local.status.spawn({
  ip: "127.0.0.1",
  port: 2000,
}, callback);
*/

const x = require("@brown-ds/distribution");
const cb1 = () => console.log("Do something useful on Node 2!");

const conf1 = {ip: "127.0.0.1", port: 8090, onStart: cb1};

const cb2 = (e, v) => console.log("I'm called in Node 1: Node 2 has booted!");

distribution.node.start(() => {
  distribution.local.status.spawn(conf1, cb2);
});
