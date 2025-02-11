/* Queries or modifies the state of all the nodes in a group. */

const remote = require("./remote.js");

const ACCUMULATE_ITEMS = ["counts", "heapTotal", "heapUsed"];

/**
 * Retrieves a status value for each node in the current group.
 */
function get(item, callback) {
  remote.checkGroup(this.gid);
  callback = callback === undefined ? (error, result) => {} : callback;
  const service = {service: "status", method: "get"};
  global.distribution[this.gid].comm.send([item], service, (error, result) => {
    if (error || !ACCUMULATE_ITEMS.includes(item)) {
      callback(error, result);
      return;
    }
    let total = 0;
    for (const id in result) {
      if (result[id] instanceof Error) {
        callback(new Error(`Node ${id} failed with '${result[id].message}'`), null);
        return;
      }
      total += result[id];
    }
    callback(null, total);
  });
}

/**
 * Creates a new node in a child process with a configuration. The node information is
 * sent to all the nodes in the current group.
 */
function spawn(config, callback) {

}

/**
 * Stops all the nodes in the current group including the current node.
 */
function stop(callback) {
  remote.checkGroup(this.gid);
  const service = {service: "status", method: "stop"};
  global.distribution[this.gid].comm.send([], service, (error, result) => {
    if (callback !== undefined) {
      callback(error, result);
    }
  });
  global.distribution.local.status.stop();
}

module.exports = (config) => {
  const context = {};
  context.gid = config?.gid === undefined ? "all" : config.gid;
  return {
    get: get.bind(context),
    spawn: spawn.bind(context),
    stop: stop.bind(context),
  };
};
