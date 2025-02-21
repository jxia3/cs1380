/* A service that stores key-value pairs in memory distributed across a group. */

const remote = require("./remote.js");
const util = require("../util/util.js");

/**
 * Retrieves an item from group in-memory store using its key.
 */
function get(config, callback) {
  checkContext(this.gid, this.hash);
  callback = callback === undefined ? (error, result) => {} : callback;
  config = util.id.getObjectConfig(config);
  if (config?.gid !== this.gid) {
    callback(new Error(`Group '${config.gid}' does not match '${this.gid}'`), null);
    return;
  }
}

/**
 * Inserts an item into the group in-memory store. If a key is not specified, then the
 * SHA256 hash of the object serialized as JSON is used.
 */
function put(config, callback) {
  checkContext(this.gid, this.hash);
  callback = callback === undefined ? (error, result) => {} : callback;
  config = util.id.getObjectConfig(config);
  if (config?.gid !== this.gid) {
    callback(new Error(`Group '${config.gid}' does not match '${this.gid}'`), null);
    return;
  }
}

/**
 * Removes an item from the group in-memory store using its key.
 */
function del(config, callback) {
  checkContext(this.gid, this.hash);
  callback = callback === undefined ? (error, result) => {} : callback;
  config = util.id.getObjectConfig(config);
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
