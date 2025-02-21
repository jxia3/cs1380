/* A service that stores key-value pairs in the local filesystem across a node group. */

const storeService = require("./store-service.js");

module.exports = storeService.createConstructor("store");
