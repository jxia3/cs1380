/* Manages the routes known by the current node group. */

const createRemoteMethod = require("./remote.js");

module.exports = (config) => {
  const context = {};
  context.gid = config?.gid === undefined ? "all" : config.gid;
  return {
    put: createRemoteMethod("routes", "put", 2).bind(context), // put(service, name, [callback])
    rem: createRemoteMethod("routes", "rem", 1).bind(context), // rem(name, [callback])
  };
};
