/* Sends messages to all nodes in the current group probabilistically. */

const remote = require("./remote-service.js");
const util = require("../util/util.js");

/**
 * Sends a gossip message to random nodes in the current group.
 */
function send(message, config, callback) {
  checkContext(this.gid, this.subset);
  callback = callback === undefined ? (error, result) => {} : callback;
  if (config?.service === undefined || config?.method === undefined) {
    callback(new Error("Service or method not provided"), null);
    return;
  }

  const payload = {config, message, groupId: this.gid};
  payload.gossipId = util.id.getMID(payload);
  sendPayload.call(this, payload, callback);
}

/**
 * Sends a gossip payload to random nodes in the current group.
 */
function sendPayload(payload, callback) {
  checkContext(this.gid, this.subset);
  callback = callback === undefined ? (error, result) => {} : callback;
  if (payload?.gossipId === undefined || payload?.config?.service === undefined
      || payload?.config?.method === undefined || payload?.message === undefined
      || payload?.groupId === undefined) {
    callback(new Error("Invalid gossip payload"), null);
    return;
  }

  global.distribution.local.groups.get(this.gid, (error, group) => {
    if (error) {
      callback(error, null);
    } else {
      sendGossip.call(this, group, payload, callback);
    }
  });
}

/**
 * Sends a gossip message to a subset of the nodes in a group.
 */
function sendGossip(group, payload, callback) {
  const groupIds = Object.keys(group);
  shuffle(groupIds);
  const nodeIds = groupIds.slice(0, this.subset(groupIds));
  const nodes = {};
  for (const id of nodeIds) {
    nodes[id] = group[id];
  }
  const service = {service: "gossip", method: "recv"};
  remote.sendRequests(nodes, service, [payload], callback);
}

/**
 * Shuffles an array in-place.
 */
function shuffle(array) {
  for (let a = array.length - 1; a > 0; a -= 1) {
    const b = Math.floor(Math.random() * (a + 1));
    const temp = array[a];
    array[a] = array[b];
    array[b] = temp;
  }
}

/**
 * Schedules a function to be run in a periodic interval.
 */
function at(interval, fn, callback) {
  const id = setInterval(fn, interval);
  if (callback !== undefined) {
    callback(null, id);
  }
}

/**
 * Deletes a scheduled function.
 */
function del(intervalId, callback) {
  clearInterval(intervalId);
  if (callback !== null) {
    callback(null, intervalId);
  }
}

/**
 * Checks if the current function context is valid.
 */
function checkContext(groupId, subset) {
  remote.checkGroup(groupId);
  if (typeof subset !== "function") {
    throw new Error("Invalid gossip subset size function");
  }
}

module.exports = (config) => {
  const context = {};
  context.gid = config?.gid === undefined ? "all" : config.gid;
  context.subset = config?.subset;
  if (typeof context.subset !== "function") {
    context.subset = (nodes) => Math.ceil(Math.log(nodes.length));
  }

  return {
    send: send.bind(context),
    sendPayload: sendPayload.bind(context),
    at: at.bind(context),
    del: del.bind(context),
  };
};
