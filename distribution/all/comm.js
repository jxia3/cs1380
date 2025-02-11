/** @typedef {import("../types").Callback} Callback */

/* Provides an interface to call services on a group of remote nodes. */

const remote = require("./remote.js");

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
  remote.checkGroup(this.gid);
  callback = callback === undefined ? (error, result) => {} : callback;
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

module.exports = remote.createConstructor({send});
