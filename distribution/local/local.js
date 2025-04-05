/*
  Service     Description                                Methods
  comm        A message communication interface          send
  gossip      The receiver part of the gossip protocol   recv
  groups      A mapping from group names to nodes        get, put, add, rem, del
  heartbeat   Detects remote node failures               receiveStatus, registerFailure
  mem         A local in-memory key-value store          get, put, del
  routes      A mapping from names to functions          get, put, rem
  rpc         A remote procedure call interface          create, call, rem
  status      Status and control of the current node     get, spawn, stop
  store       A local persistent key-value store         get, put, del, clear
*/

const status = require("./status.js");
module.exports = {
  comm: require("./comm.js"),
  gossip: require("./gossip.js"),
  groups: require("./groups.js"),
  heartbeat: require("./heartbeat.js"),
  mem: require("./mem.js"),
  routes: require("./routes.js"),
  rpc: require("./rpc.js"),
  status,
  store: require("./sharded-store.js"),

  atomicStore: require("./atomic-store.js"),
  cachedStore: require("./cached-store.js"),
  crawl: require("./crawl.js"),
  index: require("./index.js"),
  shardedStore: require("./sharded-store.js"),
};
