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
      remote.sendRequests(group, config, message, callback);
    }
  });
}

module.exports = remote.createConstructor({send});
