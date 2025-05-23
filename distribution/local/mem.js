/* A service that stores key-value pairs in local memory. */

const util = require("../util/util.js");

const store = {};

/**
 * Retrieves an item from the in-memory store using its key and group ID.
 */
function get(config, callback) {
  if (callback === undefined) {
    return;
  }
  config = util.id.getObjectConfig(config);
  if (config instanceof Error) {
    callback(config, null);
    return;
  }

  if (config.gid in store && config.key in store[config.gid]) {
    callback(null, store[config.gid][config.key]);
  } else if (config.key === null) {
    if (config.gid in store) {
      callback(null, Object.keys(store[config.gid]));
    } else {
      callback(null, []);
    }
  } else {
    callback(new Error(`Key '${config.key}' not found in group '${config.gid}'`), null);
  }
}

/**
 * Inserts an item into the in-memory store. If a key is not specified, then the SHA256
 * hash of the object serialized as JSON is used.
 */
function put(object, config, callback) {
  callback = callback === undefined ? (error, result) => {} : callback;
  config = util.id.getObjectConfig(config);
  if (config instanceof Error) {
    callback(config, null);
    return;
  }

  if (config.key === null) {
    config.key = util.id.getID(object);
  }
  if (!(config.gid in store)) {
    store[config.gid] = {};
  }
  if (config.operation === "append") {
    if (!(config.key in store[config.gid])) {
      store[config.gid][config.key] = [];
    }
    store[config.gid][config.key].push(object);
  } else {
    store[config.gid][config.key] = object;
  }

  callback(null, object);
}

/**
 * Removes an item from the in-memory store using its key and group ID.
 */
function del(config, callback) {
  callback = callback === undefined ? (error, result) => {} : callback;
  config = util.id.getObjectConfig(config);
  if (config instanceof Error) {
    callback(config, null);
    return;
  }
  if (config.key === null) {
    callback(new Error("Key cannot be null"), null);
    return;
  }

  if (config.gid in store && config.key in store[config.gid]) {
    const object = store[config.gid][config.key];
    delete store[config.gid][config.key];
    callback(null, object);
  } else {
    callback(new Error(`Key '${config.key}' not found in group '${config.gid}'`), null);
  }
}

module.exports = {get, put, del};
