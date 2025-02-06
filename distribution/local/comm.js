/** @typedef {import("../types").Callback} Callback */
/** @typedef {import("../types").Node} Node */

/* Provides an interface to call a service on a remote node. */

const log = require("../util/log.js");
const util = require("../util/util.js");

const REQUEST_TIMEOUT = 60000;

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
  if (!(message instanceof Array)) {
    callback(new Error("Message does not contain an argument list"), null);
    return;
  }

  // Send HTTP request and parse response
  try {
    const url = `http://${remote.node.ip}:${remote.node.port}/${remote.service}/${remote.method}`;
    log(`Sending service call to ${url}`);
    fetch(url, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: util.serialize(message),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT),
    })
        .then((data) => data.text())
        .then((data) => util.deserialize(data))
        .then((data) => callback(data.error, data.result))
        .catch((error) => callback(error, null));
  } catch (error) {
    callback(error, null);
  }
}

module.exports = {send};
