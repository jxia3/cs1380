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

  const orchestrator = createOrchestrator(group, orchestratorId, workerId);
  const worker = createWorker.call(this, config, orchestratorId);
  console.log(worker)
  console.log(worker.map.toString())
  console.log(worker.shuffle.toString())
  console.log(worker.reduce.toString())

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
function createOrchestrator(group, orchestratorId, workerId) {

}

/**
 * Creates a MapReduce worker service to distribute across a group of nodes.
 */
function createWorker(config, orchestratorId) {
  remote.checkGroup(this.gid);
  return {
    map: compileWorkerFn.call(this, workerMap, config, orchestratorId),
    shuffle: compileWorkerFn.call(this, workerShuffle, config, orchestratorId),
    reduce: compileWorkerFn.call(this, workerReduce, config, orchestratorId),
  };
}

/**
 * Compiles the parameters of an operation into a worker function.
 */
function compileWorkerFn(fn, config, orchestratorId) {
  remote.checkGroup(this.gid);
  const nodeInfo = `{ip: "${global.nodeConfig.ip}", port: ${global.nodeConfig.port}}`;
  const fnText = fn
      .toString()
      .replaceAll("\"__NODE_INFO__\"", nodeInfo)
      .replaceAll("\"__GROUP_ID__\"", `"${this.gid}"`)
      .replaceAll("\"__ORCHESTRATOR_ID__\"", `"${orchestratorId}"`)
      .replaceAll("\"__MAP_FN__\"", config.map.toString())
      .replaceAll("\"__REDUCE_FN__\"", config.reduce.toString());
  return (new Function(`return ${fnText}`))();
}

/**
 * Runs a local map operation and notifies the orchestrator on completion.
 */
function workerMap(config, callback) {

}

/**
 * Runs a local shuffle operation and notifies the orchestrator on completion.
 */
function workerShuffle(config, callback) {

}

/**
 * Runs a local reduce operation and notifies the orchestrator on completion.
 */
function workerReduce(config, callback) {

}

/* Note: The only method explicitly exposed in the `mr` service is `exec`.
   Other methods, such as `map`, `shuffle`, and `reduce`, should be dynamically
   installed on the remote nodes and not necessarily exposed to the user. */
module.exports = remote.createConstructor({exec});
