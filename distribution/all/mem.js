/* A service that stores key-value pairs in memory across a node group. */

const storeService = require("./store-service.js");

module.exports = storeService.createConstructor("mem");
