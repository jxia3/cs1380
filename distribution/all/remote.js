/**
 * Creates a method that sends requests to all nodes in the current group.
 */
function createRemoteMethod(service, method, numArgs) {
  if (service === undefined || method === undefined || numArgs === undefined) {
    throw new Error("Invalid remote method parameters");
  }

  function remoteMethod(...args) {
    if (this.gid === undefined || !global.distribution[this.gid]?._isGroup) {
      throw new Error(`Group '${this.gid}' does not exist`);
    }
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

module.exports = createRemoteMethod;
