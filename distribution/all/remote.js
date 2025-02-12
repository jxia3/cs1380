/**
 * Checks if a group ID is valid.
 */
function checkGroup(gid) {
  if (gid === undefined || !global.distribution[gid]?._isGroup) {
    throw new Error(`Group '${gid}' does not exist`);
  }
}

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
    global.distribution[this.gid].comm.send(params, {service, method}, (errors, results) => {
      if (args.length > numArgs && args[numArgs] !== undefined) {
        args[numArgs](errors, results);
      }
    });
  }

  return remoteMethod;
}

/**
 * Sends a message to all the nodes in a group and collects the results. Note that
 * the service configuration must be valid and the callback must be a function.
 */
function sendRequests(group, config, message, callback) {
  const ids = Object.keys(group);
  const errors = {};
  const results = {};
  let active = ids.length;
  if (active === 0) {
    callback(errors, results);
    return;
  }

  for (const id of ids) {
    const remote = {...config, node: group[id]};
    global.distribution.local.comm.send(message, remote, (error, result) => {
      if (error) {
        errors[id] = error;
      } else {
        results[id] = result;
      }
      active -= 1;
      if (active === 0) {
        callback(errors, results);
      }
    });
  }
}

module.exports = {checkGroup, createConstructor, createMethod, sendRequests};
