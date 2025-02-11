/**
 * Creates a binding constructor for a function module.
 */
function createConstructor(module) {
  if (typeof module !== "object") {
    throw new Error("Invalid module");
  }

  function constructor(config) {
    const context = {};
    context.gid = config?.gid === undefined ? "all" : config.gid;
    const fns = {};
    for (const name in module) {
      fns[name] = module[name].bind(context);
    }
    return fns;
  }

  return constructor;
}

/**
 * Creates a method that sends requests to all nodes in the current group.
 */
function createMethod(service, method, numArgs) {
  if (service === undefined || method === undefined || numArgs === undefined) {
    throw new Error("Invalid remote method parameters");
  }

  function remoteMethod(...args) {
    checkGroup(this.gid);
    const params = args.slice(0, numArgs);
    while (params.length < numArgs) {
      params.push(undefined);
    }
    global.distribution[this.gid].comm.send(params, {service, method}, (error, result) => {
      if (args.length > numArgs && args[numArgs] !== undefined) {
        args[numArgs](error, result);
      }
    });
  }

  return remoteMethod;
}

/**
 * Checks if a group ID is valid.
 */
function checkGroup(gid) {
  if (gid === undefined || !global.distribution[gid]?._isGroup) {
    throw new Error(`Group '${gid}' does not exist`);
  }
}

module.exports = {createConstructor, createMethod, checkGroup};
