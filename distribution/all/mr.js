/** @typedef {import("../types").Callback} Callback */

/* Handles MapReduce operations across a node group. Requests are distributed
   across all the nodes in a group and the result is provided in a callback on
   the orchestrator node. */

const remote = require("./remote-service.js");

let operationCount = 0;

/**
 * Map function used for MapReduce
 * @callback Mapper
 * @param {any} key
 * @param {any} value
 * @returns {object[]}
 */

/**
 * Reduce function used for MapReduce
 * @callback Reducer
 * @param {any} key
 * @param {Array} value
 * @returns {object}
 */

/**
 * @typedef {Object} MRConfig
 * @property {Mapper} map
 * @property {Reducer} reduce
 * @property {string[]} keys
 */

/**
 * Distributes a MapReduce computation across a node group and collects the result.
 * @param {MRConfig} config
 * @param {Callback} callback
 * @return {void}
 */
function exec(config, callback) {
  remote.checkGroup(this.gid);
  callback = callback === undefined ? (error, result) => {} : callback;
  if (!(config?.keys instanceof Array)) {
    callback(new Error("Invalid keys"), null);
    return;
  }
  if (typeof config?.map !== "function" || typeof config?.reduce !== "function") {
    callback(new Error("Invalid operation functions"), null);
    return;
  }
  if (config?.compact !== undefined && typeof config.compact !== "function") {
    callback(new Error("Invalid compaction function"), null);
    return;
  }

  global.distribution.local.groups.get(this.gid, (error, group) => {
    if (error) {
      callback(error, null);
      return;
    }
    runOperation.call(this, config, group, callback);
    console.log(group);
  });
}

/**
 * Runs a MapReduce operation across a group of nodes. The callback must be valid.
 */
function runOperation(config, group, callback) {
  remote.checkGroup(this.gid);
  if (global?.nodeInfo?.sid === undefined) {
    callback(new Error("Node is not online"), null);
    return;
  }
  const operationId = `mr-${global.nodeInfo.sid}-${operationCount}`;
  const orchestratorId = `orchestrator-${operationId}`;
  const workerId = `worker-${operationId}`;
  operationCount += 1;
  console.log(operationId);

  const orchestrator = createOrchestrator(group);
  const worker = createWorker(group, orchestratorId);
  global.distribution.local.routes.put(orchestrator, orchestratorId, (error, result) => {
    if (error) {
      callback(error, null);
      return;
    }
    console.log("added service", orchestrator, orchestratorId);
    global.distribution[this.gid].routes.put(worker, workerId, (errors, results) => {
      if (Object.keys(errors).length > 0) {
        callback(new Error("Failed to install worker service"), null);
        return;
      }
      console.log("added service", worker, workerId);
    });
  });
}

/**
 * Creates a MapReduce orchestration service for a group of nodes.
 */
function createOrchestrator(group) {

}

/**
 * Creates a MapReduce worker service to distribute across a group of nodes.
 */
function createWorker(group) {

}

/**
 * Receives completion notifications from nodes and schedules MapReduce operations.
 */
function notify(config, callback) {

}

/* Note: The only method explicitly exposed in the `mr` service is `exec`.
   Other methods, such as `map`, `shuffle`, and `reduce`, should be dynamically
   installed on the remote nodes and not necessarily exposed to the user. */
module.exports = remote.createConstructor({exec});
