/* A service that stores key-value pairs distributed across a group. */

const remote = require("./remote.js");
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
    getItem.call(this, config, callback);
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

    // Send item to node
    if (config.key === null) {
      config.key = util.id.getID(object);
    }
    const node = util.id.applyHash(config.key, group, this.hash);
    const remote = {node, service: this.storeService, method: "put"};
    global.distribution.local.comm.send([object, config], remote, callback);
  });
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
}

/**
 * Rebalances items across a group when membership is changed.
 */
function reconf(config, callback) {
  checkContext(this.storeService, this.gid, this.hash);
  callback = callback === undefined ? (error, result) => {} : callback;
}

/**
 * Checks if the current function context is valid.
 */
function checkContext(storeService, gid, hash) {
  if (!STORE_SERVICES.includes(storeService)) {
    throw new Error("Invalid store service");
  }
  remote.checkGroup(gid);
  if (typeof hash !== "function") {
    throw new Error("Invalid store hash function");
  }
}

/**
 * Retrieves an item from the distributed group. The callback must be valid.
 */
function getItem(config, callback) {
  global.distribution.local.groups.get(this.gid, (error, group) => {
    if (error) {
      callback(error, null);
      return;
    }
    const node = util.id.applyHash(config.key, group, this.hash);
    const remote = {node, service: this.storeService, method: "get"};
    global.distribution.local.comm.send([config], remote, callback);
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
