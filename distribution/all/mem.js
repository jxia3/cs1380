/* A service that stores key-value pairs in memory across a node group. */

const distributedStore = require("./distributed-store.js");

module.exports = distributedStore.createConstructor("mem");
