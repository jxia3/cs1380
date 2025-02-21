/* A service that stores key-value pairs distributed across a group. */

const remote = require("./remote.js");
const util = require("../util/util.js");

/**
 * Retrieves an item from a distributed group store using its key.
 */
function get(config, callback) {
  checkContext(this.gid, this.hash);
  callback = callback === undefined ? (error, result) => {} : callback;
  config = util.id.getObjectConfig(config, this.gid);
  if (config?.gid !== this.gid) {
    callback(new Error(`Group '${config.gid}' does not match '${this.gid}'`), null);
    return;
  }

  if (config.key !== null) {
    // Find all keys and collect results
    const service = {service: "mem", method: "get"};
    const args = [{key: null, gid: this.gid}];
    global.distribution[this.gid].comm.send(args, service, (errors, results) => {
      const keys = Object.values(results).flat();
      callback(errors, keys);
    });
  } else {
    // Retrieve specific object from node
    getItem.call(this, config, callback);
  }
}

/**
 * Inserts an item into the distributed group store. If a key is not specified, then the
 * SHA256 hash of the object serialized as JSON is used.
 */
function put(object, config, callback) {
  checkContext(this.gid, this.hash);
  callback = callback === undefined ? (error, result) => {} : callback;
  config = util.id.getObjectConfig(config, this.gid);
  if (config?.gid !== this.gid) {
    callback(new Error(`Group '${config.gid}' does not match '${this.gid}'`), null);
    return;
  }
}

/**
 * Removes an item from the distributed group store using its key.
 */
function del(config, callback) {
  checkContext(this.gid, this.hash);
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
  checkContext(this.gid, this.hash);
  callback = callback === undefined ? (error, result) => {} : callback;
}

/* Checks if the current function context is valid. */
function checkContext(gid, hash) {
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
    console.log("FOUND NODE:", config, this.gid, node);
    process.exit(0);
  });
}

module.exports = (config) => {
  const context = {};
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
};
