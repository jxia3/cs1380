/* A service that stores key-value pairs in the local file system across a node group. */

const store = require("./store-service.js");

module.exports = store.createConstructor("store");
