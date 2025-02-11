/* Manages the groups known by the current node group. */

/**
 * Creates a group method that requests all the nodes in the current group.
 */
function createRemoteMethod(method, numArgs) {
  function remoteMethod(...args) {
    if (this.gid === undefined || !global.distribution[this.gid]?._isGroup) {
      throw new Error(`Group '${this.gid}' does not exist`);
    }
    const service = {service: "groups", method};
    const params = args.slice(0, numArgs);
    while (params.length < numArgs) {
      params.push(undefined);
    }
    global.distribution[this.gid].comm.send(params, service, (error, result) => {
      if (args.length > numArgs && args[numArgs] !== undefined) {
        args[numArgs](error, result);
      }
    });
  }
  return remoteMethod;
}

module.exports = (config) => {
  const context = {};
  context.gid = config?.gid === undefined ? "all" : config.gid;
  return {
    get: createRemoteMethod("get", 1).bind(context), // get(name, [callback])
    put: createRemoteMethod("put", 2).bind(context), // put(name, group, [callback])
    del: createRemoteMethod("del", 1).bind(context), // del(name, [callback])
    add: createRemoteMethod("add", 2).bind(context), // add(name, node, [callback])
    rem: createRemoteMethod("rem", 2).bind(context), // rem(name, node, [callback])
  };
};
