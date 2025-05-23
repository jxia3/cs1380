/*
  Service   Description                            Methods
  comm      A message communication interface      send
  gossip    Status and information dissemination   send, at, del
  groups    A mapping from group names to nodes    get,put, add, rem, del
  mem       An ephemeral (in-memory) store         get, put, del, reconf
  mr        A map-reduce implementation            exec
  routes    A mapping from names to functions      put
  status    Information about the current group    get, stop, spawn
  store     A persistent store                     get, put, del, reconf
*/
const params = require("../params.js");
USE_QUERY = params.enableQuery;

module.exports = {
  comm: require("./comm.js"),
  gossip: require("./gossip.js"),
  groups: require("./groups.js"),
  mem: require("./mem.js"),
  mr: require("./mr.js"),
  routes: require("./routes.js"),
  status: require("./status.js"),
  store: require("./store.js"),

  crawl: require("./crawl.js"),
  index: require("./index.js"),
  search: require("./search.js"),
  termLookup: require("./term-lookup.js"),
  query: USE_QUERY ? require("./query.js") : null
};
