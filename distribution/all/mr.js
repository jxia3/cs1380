/** @typedef {import("../types").Callback} Callback */

/* Handles MapReduce operations across a node group. Requests are distributed
   across all the nodes in a group and the result is provided in a callback on
   the orchestrator node. */

const remote = require("./remote-service.js");
const util = require("../util/util.js");

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
    createOperation.call(this, config, group, callback);
  });
}

/**
 * Sets up a MapReduce operation across a group of nodes. The callback must be valid.
 */
function createOperation(config, group, callback) {
  remote.checkGroup(this.gid);
  if (global?.nodeInfo?.sid === undefined) {
    callback(new Error("Node is not online"), null);
    return;
  }
  const operationId = `mr-${global.nodeInfo.sid}-${operationCount}`;
  const workerId = `worker-${operationId}`;
  operationCount += 1;

  const worker = createWorker.call(this, config, operationId);
  global.distribution[this.gid].routes.put(worker, workerId, (errors, results) => {
    if (Object.keys(errors).length > 0) {
      callback(new Error("Failed to install worker service"), null);
      return;
    }
    config.operationId = operationId;
    config.workerId = workerId;
    runOperation.call(this, config, group, callback);
  });
}

/**
 * Creates a MapReduce worker service to distribute across a group of nodes.
 * The parameters for the operation are compiled into the functions.
 */
function createWorker(config, operationId) {
  remote.checkGroup(this.gid);

  const workerConfig = {...config};
  delete workerConfig.keys;
  const compileParams = {
    "__NODE_INFO__": {ip: global.nodeConfig.ip, port: global.nodeConfig.port},
    "__GROUP_ID__": this.gid,
    "__OPERATION_ID__": operationId,
    "__CONFIG__": util.serialize(workerConfig),
  };

  return {
    map: util.compile(workerMap, compileParams),
    shuffle: util.compile(workerShuffle, compileParams),
    reduce: util.compile(workerReduce, compileParams),
  };
}

/**
 * Runs a local map operation and notifies the orchestrator on completion.
 */
function workerMap(keys, callback) {
  const config = global.distribution.util.deserialize("__CONFIG__");
  console.log("called map", global.nodeInfo.sid, config)
}

/**
 * Runs a local shuffle operation and notifies the orchestrator on completion.
 */
function workerShuffle(callback) {
  const config = global.distribution.util.deserialize("__CONFIG__");
}

/**
 * Runs a local reduce operation and notifies the orchestrator on completion.
 */
function workerReduce(callback) {
  const config = global.distribution.util.deserialize("__CONFIG__");
}

/**
 * Runs a MapReduce operation across a group of nodes. The callback must be valid.
 */
function runOperation(config, group, callback) {
  remote.checkGroup(this.gid);
  const groupHashFn = global.distribution[this.gid]?._state?.hash;
  const hashFn = groupHashFn === undefined ? util.id.naiveHash : groupHashFn;

  // Partition keys across nodes
  const partition = {};
  for (const node in group) {
    partition[node] = [];
  }
  for (const key of config.keys) {
    const node = util.id.applyHash(key, group, hashFn);
    partition[node].push(key);
  }

  // Run MapReduce phases and aggregate results
  runPhase.call(this, config, group, (node) => [partition[node]], "map", (error, results) => {
    if (error) {
      callback(error, null);
      return;
    }
    console.log("Finished map");
    console.log(error, results);
  });
}

/**
 * Sends a signal to a group of nodes to run a MapReduce phase. The callback must be valid.
 */
function runPhase(config, group, argumentFn, phase, callback) {
  remote.checkGroup(this.gid);
  const results = {};
  let active = Object.keys(group).length;

  for (const node in group) {
    const remote = {node: group[node], service: config.workerId, method: phase};
    global.distribution.local.comm.send(argumentFn(node), remote, (error, result) => {
      if (!error) {
        results[node] = result;
      }
      active -= 1;
      if (active === 0) {
        callback(null, results);
      }
    });
  }
}

/* Note: The only method explicitly exposed in the `mr` service is `exec`.
   Other methods, such as `map`, `shuffle`, and `reduce`, should be dynamically
   installed on the remote nodes and not necessarily exposed to the user. */
module.exports = remote.createConstructor({exec});
