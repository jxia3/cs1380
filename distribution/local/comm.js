/** @typedef {import("../types").Callback} Callback */
/** @typedef {import("../types").Node} Node */

/* Provides an interface to call a service on a remote node. */

const log = require("../util/log.js");
const util = require("../util/util.js");

const http = require("http");

const OPTIMIZE_LOCAL = true;
const REQUEST_TIMEOUT = 300000;
const DISABLE_LOGS = ["gossip", "heartbeat"];

/**
 * @typedef {Object} Target
 * @property {string} service
 * @property {string} method
 * @property {Node} node
 * @property {string} gid
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
  callback = util.sync.createGuardedCallback(callback);
  if (remote?.node?.ip === undefined || remote?.node?.port === undefined
      || remote?.service === undefined || remote?.method === undefined) {
    callback(new Error("Invalid remote node configuration"), null);
    return;
  }
  if (!(message instanceof Array)) {
    callback(new Error("Message does not contain an argument list"), null);
    return;
  }

  // Check for requests to the local node
  const groupId = remote.gid === undefined ? "local" : remote.gid;
  if (OPTIMIZE_LOCAL && groupId === "local"
      && remote.node.ip === global.nodeConfig?.ip
      && remote.node.port === global.nodeConfig?.port) {
    let returned = false;
    try {
      global.distribution.local[remote.service][remote.method](...message, (...args) => {
        returned = true;
        callback(...args);
      });
    } catch (error) {
      if (!returned) {
        callback(error, null);
      } else {
        console.error(error);
      }
    }
    return;
  }

  // Send HTTP request and parse response
  try {
    const url = `http://${remote.node.ip}:${remote.node.port}/${groupId}/${remote.service}/${remote.method}`;
    const timeout = remote?.timeout === undefined ? REQUEST_TIMEOUT : remote?.timeout;
    if (!DISABLE_LOGS.includes(remote.service)) {
      // log(`Sending service call to ${url}`);
    }
    callService(url, util.serialize(message), timeout, callback);
  } catch (error) {
    callback(error, null);
  }
}

/**
 * Sends an HTTP request to call a service on a remote node.
 */
function callService(url, body, timeout, callback) {
  const request = http.request(url, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    timeout,
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

/**
 * Handles an HTTP response for a service request.
 */
function handleResponse(response, callback) {
  let content = "";
  response.on("data", (chunk) => content += chunk);
  response.on("end", () => {
    let data = null;
    try {
      data = util.deserialize(content);
    } catch (error) {
      callback(new Error("Unable to deserialize response body"), null);
      return;
    }
    callback(data?.error, data?.result);
  });
}

module.exports = {send};
