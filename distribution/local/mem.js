/* A service that stores key-value pairs in local memory. */

const util = require("../util/util.js");

const store = {local: {}, all: {}};

/**
 * Retrieves an item from the store using its key and group ID.
 */
function get(config, callback) {
  if (callback === undefined) {
    return;
  }
  config = util.id.getObjectKey(config);
  if (config instanceof Error) {
    callback(config, null);
    return;
  }
  if (config.gid in store && config.key in store[config.gid]) {
    callback(null, store[config.gid][config.key]);
  } else {
    callback(new Error(`Key '${config.key}' not found in group '${config.gid}'`), null);
  }
}

/**
 * Inserts an item into the store. If a key is not specified, then the SHA256 hash of
 * the object serialized as JSON is used.
 */
function put(object, config, callback) {

}

/**
 * Removes an item from the store using its key and group ID.
 */
function del(config, callback) {

}

module.exports = {get, put, del};
