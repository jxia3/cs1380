/* A service that stores key-value pairs distributed across a group. */

const remote = require("./remote-service.js");
const util = require("../util/util.js");

const STORE_SERVICES = ["mem", "store"];

/**
 * Retrieves an item from a distributed group store using its key.
 */
function get(config, callback) {
  checkContext(this.storeService, this.gid, this.hash);
  callback = callback === undefined ? (error, result) => {} : callback;
  config = util.id.getObjectConfig(config, this.gid);
  if (config?.gid !== this.gid) {
    callback(new Error(`Group '${config.gid}' does not match '${this.gid}'`), null);
    return;
  }

  if (config.key !== null) {
    // Retrieve specific object from node
    routeRequest.call(this, config.key, "get", [config], callback);
  } else {
    // Find all keys and collect results
    const service = {service: this.storeService, method: "get"};
    const args = [{key: null, gid: this.gid}];
    global.distribution[this.gid].comm.send(args, service, (errors, results) => {
      callback(errors, Object.values(results).flat());
    });
  }
}

/**
 * Inserts an item into the distributed group store. If a key is not specified, then the
 * SHA256 hash of the object serialized as JSON is used.
 */
function put(object, config, callback) {
  checkContext(this.storeService, this.gid, this.hash);
  callback = callback === undefined ? (error, result) => {} : callback;
  config = util.id.getObjectConfig(config, this.gid);
  if (config?.gid !== this.gid) {
    callback(new Error(`Group '${config.gid}' does not match '${this.gid}'`), null);
    return;
  }

  if (config.key === null) {
    config.key = util.id.getID(object);
  }
  routeRequest.call(this, config.key, "put", [object, config], callback);
}

/**
 * Removes an item from the distributed group store using its key.
 */
function del(config, callback) {
  checkContext(this.storeService, this.gid, this.hash);
  callback = callback === undefined ? (error, result) => {} : callback;
  config = util.id.getObjectConfig(config, this.gid);
  if (config?.gid !== this.gid) {
    callback(new Error(`Group '${config.gid}' does not match '${this.gid}'`), null);
    return;
  }
  if (config.key === null) {
    callback(new Error("Key cannot be null"), null);
    return;
  }
  routeRequest.call(this, config.key, "del", [config], callback);
}

/**
 * Rebalances items across a group when membership is changed.
 */
function reconf(config, callback) {
  checkContext(this.storeService, this.gid, this.hash);
  callback = callback === undefined ? (error, result) => {} : callback;
  if (Object.keys(config).length === 0) {
    callback(new Error("Previous instance of group has no nodes"), null);
    return;
  }

  // Get current group and all item keys
  global.distribution.local.groups.get(this.gid, (error, group) => {
    if (error) {
      callback(error, null);
      return;
    }
    global.distribution[this.gid][this.storeService].get(null, (errors, keys) => {
      for (const nodeId in errors) {
        console.error(errors[nodeId]);
      }
      rebalanceItems.call(this, config, group, keys, callback);
    });
  });
}

/**
 * Redistributes items with changed locations across a group.
 */
function rebalanceItems(oldGroup, newGroup, keys, callback) {
  // Compute changed keys
  const changed = {};
  let active = 0;
  for (const key of keys) {
    const oldNode = util.id.applyHash(key, oldGroup, this.hash);
    const newNode = util.id.applyHash(key, newGroup, this.hash);
    if (oldNode !== newNode) {
      changed[key] = oldNode;
      active += 1;
    }
  }
  if (active === 0) {
    callback(null, null);
    return;
  }

  // Send change requests
  for (const key in changed) {
    const remote = {node: oldGroup[changed[key]], service: this.storeService, method: "del"};
    const args = [{key, gid: this.gid}];
    global.distribution.local.comm.send(args, remote, (error, object) => {
      if (error) {
        active -= 1;
        return;
      }
      global.distribution[this.gid][this.storeService].put(object, key, (error, result) => {
        active -= 1;
        if (active === 0) {
          callback(null, null);
        }
      });
    });
  }
}

/**
 * Checks if the current function context is valid.
 */
function checkContext(storeService, groupId, hashFn) {
  if (!STORE_SERVICES.includes(storeService)) {
    throw new Error("Invalid store service");
  }
  remote.checkGroup(groupId);
  if (typeof hashFn !== "function") {
    throw new Error("Invalid store hash function");
  }
}

/**
 * Routes a service request for an object key to a remote node. The callback must be valid.
 */
function routeRequest(key, method, args, callback) {
  global.distribution.local.groups.get(this.gid, (error, group) => {
    // Check node group
    if (error) {
      callback(error, null);
      return;
    }
    if (Object.keys(group).length === 0) {
      callback(new Error(`Group '${this.gid}' has no nodes`), null);
      return;
    }

    // Send request to node
    const node = group[util.id.applyHash(key, group, this.hash)];
    if (node?.ip === undefined || node?.port === undefined) {
      callback(new Error("Request routed to invalid node"), null);
      return;
    }
    const remote = {node, service: this.storeService, method};
    global.distribution.local.comm.send(args, remote, callback);
  });
}

/**
 * Creates a binding constructor for a function module.
 */
function createConstructor(storeService) {
  if (!STORE_SERVICES.includes(storeService)) {
    throw new Error("Invalid store service");
  }

  function constructor(config) {
    const context = {};
    context.storeService = storeService;
    context.gid = config?.gid === undefined ? "all" : config.gid;
    context.hash = config?.hash;
    if (typeof context.hash !== "function") {
      context.hash = util.id.naiveHash;
    }
    if (global.distribution[context.gid]._state) {
      global.distribution[context.gid]._state.hash = context.hash;
    }

    return {
      get: get.bind(context),
      put: put.bind(context),
      del: del.bind(context),
      reconf: reconf.bind(context),
    };
  }

  return constructor;
}

module.exports = {createConstructor};
