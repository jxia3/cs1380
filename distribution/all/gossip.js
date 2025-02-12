/* Sends messages to all nodes in the current group probabilistically. */

const remote = require("./remote.js");

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
      sendGossip(group, this.subset, config, message, callback);
    }
  });
}

/**
 * Sends a gossip message to a subset of the nodes in a group.
 */
function sendGossip(group, subsetFn, config, message, callback) {
  console.log("sending gossip", group, subsetFn.toString());
  process.exit()
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
