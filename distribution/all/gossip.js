/* Sends messages to all nodes in the current group probabilistically. */

const remote = require("./remote.js");

/**
 * Sends a message to random nodes in the current group.
 */
function send(message, config, callback) {
  remote.checkGroup(this.gid);
}

/**
 * Schedules a function to be run in a periodic interval.
 */
function at(interval, fn, callback) {

}

/**
 * Deletes a scheduled function.
 */
function del(fnId, callback) {

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
