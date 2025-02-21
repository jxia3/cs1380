/* A service that stores key-value pairs in the local filesystem across a node group. */

const distributedStore = require("./distributed-store.js");

module.exports = distributedStore.createConstructor("store");
