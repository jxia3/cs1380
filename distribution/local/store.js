/* A service that stores key-value pairs in the local filesystem. */

const util = require("../util/util.js");

const fs = require("fs");

/**
 * Retrieves an item from the filesystem store using its key and group ID.
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

  if (config.key !== null) {

  } else if (config.key === null) {
    
  }
}

/**
 * Inserts an item into the filesystem store. If a key is not specified, then the SHA256
 * hash of the object serialized as JSON is used.
 */
function put(object, config, callback) {

}

/**
 * Removes an item from the filesystem store using its key and group ID.
 */
function del(config, callback) {

}

module.exports = {get, put, del};
