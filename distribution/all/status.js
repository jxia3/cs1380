/* Queries or modifies the state of all the nodes in a group. */

const remote = require("./remote-service.js");

const ACCUMULATE_ITEMS = ["counts", "heapTotal", "heapUsed"];

/**
 * Retrieves a status value for each node in the current group.
 */
function get(item, callback) {
  remote.checkGroup(this.gid);
  callback = callback === undefined ? (error, result) => {} : callback;
  const service = {service: "status", method: "get"};
  global.distribution[this.gid].comm.send([item], service, (errors, results) => {
    if (!ACCUMULATE_ITEMS.includes(item)) {
      callback(errors, results);
      return;
    }

    let total = 0;
    for (const id in results) {
      if (typeof results[id] === "number") {
        total += results[id];
      } else {
        errors[id] = new Error(`Returned value ${results[id]} is not a number`);
        delete results[id];
      }
    }

    callback(errors, total);
  });
}

/**
 * Creates a new node in a child process with a configuration. The node information is
 * sent to all the nodes in the current group.
 */
function spawn(config, callback) {
  remote.checkGroup(this.gid);
  callback = callback === undefined ? (error, result) => {} : callback;
  global.distribution.local.status.spawn(config, (error, node) => {
    if (error) {
      callback(error, null);
      return;
    }

    global.distribution.local.groups.add(this.gid, node, (addError, result) => {
      const service = {service: "groups", method: "add"};
      global.distribution[this.gid].comm.send([this.gid, node], service, (errors, results) => {
        if (addError) {
          callback(addError, null);
        } else {
          callback(null, node);
        }
      });
    });
  });
}

/**
 * Stops all the nodes in the current group including the current node.
 */
function stop(callback) {
  remote.checkGroup(this.gid);
  const service = {service: "status", method: "stop"};
  global.distribution[this.gid].comm.send([], service, (errors, results) => {
    if (callback !== undefined) {
      callback(errors, results);
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
