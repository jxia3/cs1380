/* A service that stores key-value pairs in memory across a node group. */

const store = require("./store-service.js");

module.exports = store.createConstructor("mem");
