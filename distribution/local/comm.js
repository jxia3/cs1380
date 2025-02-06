/** @typedef {import("../types").Callback} Callback */
/** @typedef {import("../types").Node} Node */

/* Provides an interface to call a service on a remote node. */

const log = require("../util/log.js");
const util = require("../util/util.js");

const REQUEST_TIMEOUT = 20000;

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
  callback = createGuardedCallback(callback);
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
    callService(url, util.serialize(message), callback);
  } catch (error) {
    callback(error, null);
  }
}

/* Creates a callback function that can only be called once. */
function createGuardedCallback(callback) {
  let callCount = 0;
  function guardedCallback(error, result) {
    if (callCount > 0) {
      log(`Guarded callback called ${callCount} times`);
      return;
    }
    callCount += 1;
    if (callback !== undefined) {
      callback(error, result);
    }
  }
  return guardedCallback;
}

/* Sends an HTTP request to call a service on a remote node. */
function callService(url, body, callback) {
  log(`Sending service call to ${url}`);
  const request = http.request(url, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    timeout: REQUEST_TIMEOUT,
  }, (response) => handleResponse(response, callback));

  request.on("timeout", () => {
    log(`Service call to ${url} timed out`);
    request.destroy(new Error("Request timed out"));
  });

  request.on("error", (error) => {
    callback(error, null);
  });

  request.end(body);
}

/* Handles an HTTP response for a service request. */
function handleResponse(response, callback) {
  let content = "";
  response.on("data", (chunk) => content += chunk);
  response.on("end", () => {
    try {
      const data = util.deserialize(content);
      callback(data?.error, data?.result);
    } catch (error) {
      callback(new Error("Unable to deserialize response body"), null);
    }
  });
}

module.exports = {send};
