/** @typedef {import("../types").Callback} Callback */

/* Provides an interface to call services on a group of remote nodes. */

/**
 * NOTE: This Target is slightly different from local.all.Target
 * @typdef {Object} Target
 * @property {string} service
 * @property {string} method
 */

/**
 * Sends a message to all the nodes in the current group.
 * @param {Array} message
 * @param {object} config
 * @param {Callback} callback
 */
function send(message, config, callback) {
  callback = callback === undefined ? (error, result) => {} : callback;
  if (this.gid === undefined || !global.distribution[this.gid]?._isGroup) {
    throw new Error(`Group '${this.gid}' does not exist`);
  }
  if (config?.service === undefined || config?.method === undefined) {
    callback(new Error("Service or method not provided"), null);
    return;
  }

  global.distribution.local.groups.get(this.gid, (error, group) => {
    if (error) {
      callback(error, null);
    } else {
      sendRequests(group, config, message, callback);
    }
  });
}

/**
 * Sends a message to all the nodes in a group and collects the results.
 */
function sendRequests(group, config, message, callback) {
  const ids = Object.keys(group);
  const results = {};
  let active = ids.length;
  if (active === 0) {
    callback(null, results);
    return;
  }

  for (const id of ids) {
    const remote = {...config, node: group[id]};
    global.distribution.local.comm.send(message, remote, (error, result) => {
      results[id] = error || result;
      active -= 1;
      if (active === 0) {
        callback(null, results);
      }
    });
  }
}

module.exports = (config) => {
  const context = {};
  context.gid = config?.gid === undefined ? "all" : config.gid;
  return {
    send: send.bind(context),
  };
};
