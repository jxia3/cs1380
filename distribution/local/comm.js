/** @typedef {import("../types").Callback} Callback */
/** @typedef {import("../types").Node} Node */

/* Provides an interface to call a service on a remote node. */

const log = require("../util/log.js");

/**
 * @typedef {Object} Target
 * @property {string} service
 * @property {string} method
 * @property {Node} node
 */

/**
 * Sends a message to call a service on a remote node.
 * @param {Array} message
 * @param {Target} remote
 * @param {Callback} [callback]
 * @return {void}
 */
function send(message, remote, callback) {
  // Check service call arguments
  if (remote?.node?.ip === undefined || remote?.node?.port === undefined
      || remote?.service === undefined || remote?.method === undefined) {
    callback(new Error("Invalid remote node configuration"), null);
    return;
  }
  if (message === undefined) {
    message = [];
  }
  if (!(message instanceof Array)) {
    callback(new Error("Message does not contain an argument list"), null);
    return;
  }

  try {
    const url = `http://${remote.node.ip}:${remote.node.port}/${remote.service}/${remote.method}`;
    log(`Sending service call to ${url}`);
  } catch (error) {
    callback(error, null);
  }
}

module.exports = {send};
