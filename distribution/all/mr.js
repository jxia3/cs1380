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
  callback = callback === undefined ? (error, result) => {} : callback;
  const groupId = "__GROUP_ID__";
  const operationId = "__OPERATION_ID__";
  const config = global.distribution.util.deserialize("__CONFIG__");
  if (!global.distribution[groupId]?._isGroup) {
    callback(new Error(`Group '${groupId}' does not exist`), null);
    return;
  }

  // Initialize map results
  const values = {};
  let active = keys.length;
  if (active === 0) {
    callback(null, null);
    return;
  }

  for (const key of keys) {
    global.distribution[groupId].store.get(key, (error, value) => {
      // Run map function on value
      try {
        if (!error) {
          let result = config.map(key, value);
          result = result instanceof Array ? result : [result];
          for (const item of result) {
            for (const key in item) {
              if (!(key in values)) {
                values[key] = [];
              }
              values[key].push(item[key]);
            }
          }
        }
      } catch {}

      active -= 1;
      if (active === 0) {
        // Compact results
        const results = [];
        for (const key in values) {
          if (config.compact === undefined) {
            for (const value of values[key]) {
              results.push({[key]: value});
            }
          } else {
            results.push({[key]: config.compact(values[key])});
          }
        }

        // Store results and notify orchestrator
        const mapResultKey = `map-${operationId}`;
        global.distribution.local.store.put(results, mapResultKey, (error, result) => {
          if (error) {
            callback(error, null);
          } else {
            callback(null, null);
          }
        });
      }
    });
  }
}

/**
 * Runs a local shuffle operation and notifies the orchestrator on completion.
 */
function workerShuffle(callback) {
  callback = callback === undefined ? (error, result) => {} : callback;
  const groupId = "__GROUP_ID__";
  const operationId = "__OPERATION_ID__";
  if (!global.distribution[groupId]?._isGroup) {
    callback(new Error(`Group '${groupId}' does not exist`), null);
    return;
  }

  const mapResultKey = `map-${operationId}`;
  global.distribution.local.store.del(mapResultKey, (error, results) => {
    if (error || results.length === 0) {
      callback(null, null);
      return;
    }

    // Aggregate local values
    const values = {};
    for (const result of results) {
      for (const key in result) {
        if (!(key in values)) {
          values[key] = [];
        }
        values[key].push(result[key]);
      }
    }

    // Distribute values across group memory
    let active = Object.keys(values).length;
    for (const key in values) {
      const item = {key, values: values[key]};
      const itemConfig = {key: `shuffle-${operationId}-${key}`, gid: groupId, operation: "append"};
      global.distribution[groupId].mem.put(item, itemConfig, (error, result) => {
        active -= 1;
        if (active === 0) {
          callback(null, null);
        }
      });
    }
  });
}

/**
 * Runs a local reduce operation and notifies the orchestrator on completion.
 */
function workerReduce(callback) {
  callback = callback === undefined ? (error, result) => {} : callback;
  const groupId = "__GROUP_ID__";
  const operationId = "__OPERATION_ID__";
  const config = global.distribution.util.deserialize("__CONFIG__");
  if (!global.distribution[groupId]?._isGroup) {
    callback(new Error(`Group '${groupId}' does not exist`), null);
    return;
  }

  global.distribution.local.mem.get({key: null, gid: groupId}, (error, itemKeys) => {
    // Initialize reduce results
    if (!error) {
      itemKeys = itemKeys.filter((k) => k.startsWith(`shuffle-${operationId}`));
    }
    const results = [];
    let active = itemKeys.length;
    if (error || active === 0) {
      callback(null, results);
      return;
    }

    for (const itemKey of itemKeys) {
      global.distribution.local.mem.del({key: itemKey, gid: groupId}, (error, items) => {
        // Run reduce function on values
        try {
          if (!error && items.length > 0) {
            const key = items[0].key;
            const values = items.map((i) => i.values).flat();
            const result = config.reduce(key, values);
            results.push(result);
          }
        } catch {}

        // Notify orchestrator
        active -= 1;
        if (active === 0) {
          callback(null, results);
        }
      });
    }
  });
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
    runPhase.call(this, config, group, (node) => [], "shuffle", (error, results) => {
      if (error) {
        callback(error, null);
        return;
      }
      runPhase.call(this, config, group, (node) => [], "reduce", (error, results) => {
        if (error) {
          callback(error, null);
          return;
        }
        global.distribution[this.gid].routes.rem(config.workerId);
        callback(null, Object.values(results).flat());
      });
    });
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
