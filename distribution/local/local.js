/*

Service  Description                                Methods
comm     A message communication interface          send
gossip   The receiver part of the gossip protocol   recv
groups   A mapping from group names to nodes        get, put, add, rem, del
routes   A mapping from names to functions          get, put, rem
rpc      A remote procedure call interface          get, put, rem
status   Status and control of the current node     get, spawn, stop

*/

module.exports = {
  comm: require("./comm.js"),
  gossip: require("./gossip.js"),
  groups: require("./groups.js"),
  mem: require("./mem.js"),
  routes: require("./routes.js"),
  rpc: require("./rpc.js"),
  status: require("./status.js"),
  store: require("./store.js"),
};
