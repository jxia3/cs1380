/* Sends messages to all nodes in the current group probabilistically. */

const remote = require("./remote.js");
const util = require("../util/util.js");

/**
 * Sends a message to random nodes in the current group.
 */
function send(message, config, callback) {
  checkContext(this.gid, this.subset);
  callback = callback === undefined ? (error, result) => {} : callback;
  if (config?.service === undefined || config?.method === undefined) {
    callback(new Error("Service or method not provided"), null);
    return;
  }
  global.distribution.local.groups.get(this.gid, (error, group) => {
    if (error) {
      callback(error, null);
    } else {
      sendGossip.call(this, group, config, message, callback);
    }
  });
}

/**
 * Sends a gossip message to a subset of the nodes in a group.
 */
function sendGossip(group, config, message, callback) {
  // Select recipient nodes
  const groupIds = Object.keys(group);
  shuffle(groupIds);
  const nodeIds = groupIds.slice(0, this.subset(groupIds));
  const nodes = {};
  for (const id of nodeIds) {
    nodes[id] = group[id];
  }
  console.log("sending gossip", nodes, message);

  // Send gossip message
  const gossipMessage = {config, message, groupId: this.gid};
  gossipMessage.gossipId = util.id.getMID(gossipMessage);
  const service = {service: "gossip", method: "recv"};
  remote.sendRequests(nodes, service, [gossipMessage], callback);
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
  checkContext(this.gid, this.subset);
}

/**
 * Deletes a scheduled function.
 */
function del(fnId, callback) {
  checkContext(this.gid, this.subset);
}

/* Checks if the current function context is valid. */
function checkContext(gid, subset) {
  remote.checkGroup(gid);
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
    at: at.bind(context),
    del: del.bind(context),
  };
};
