/* Manages the groups known by the current node group. */

const createRemoteMethod = require("./remote.js");

module.exports = (config) => {
  const context = {};
  context.gid = config?.gid === undefined ? "all" : config.gid;
  return {
    get: createRemoteMethod("groups", "get", 1).bind(context), // get(name, [callback])
    put: createRemoteMethod("groups", "put", 2).bind(context), // put(name, group, [callback])
    del: createRemoteMethod("groups", "del", 1).bind(context), // del(name, [callback])
    add: createRemoteMethod("groups", "add", 2).bind(context), // add(name, node, [callback])
    rem: createRemoteMethod("groups", "rem", 2).bind(context), // rem(name, node, [callback])
  };
};
