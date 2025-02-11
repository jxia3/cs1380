/* Manages the groups known by the current node group. */

const remote = require("./remote.js");

module.exports = remote.createConstructor({
  get: remote.createMethod("groups", "get", 1), // get(name, [callback])
  put: remote.createMethod("groups", "put", 2), // put(name, group, [callback])
  del: remote.createMethod("groups", "del", 1), // del(name, [callback])
  add: remote.createMethod("groups", "add", 2), // add(name, node, [callback])
  rem: remote.createMethod("groups", "rem", 2), // rem(name, node, [callback])
});
