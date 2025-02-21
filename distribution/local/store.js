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

  if (global?.nodeInfo?.storePath === undefined) {
    callback(new Error("Store path not available"), null);
    return;
  }
  if (config.key !== null) {
    getItem(config.key, callback);
  } else {
    getAllItems(callback);
  }
}

/**
 * Inserts an item into the filesystem store. If a key is not specified, then the SHA256
 * hash of the object serialized as JSON is used.
 */
function put(object, config, callback) {
  callback = callback === undefined ? (error, result) => {} : callback;
  config = util.id.getObjectConfig(config);
  if (config instanceof Error) {
    callback(config, null);
    return;
  }
  if (global?.nodeInfo?.storePath === undefined) {
    callback(new Error("Store path not available"), null);
    return;
  }

  if (config.key === null) {
    config.key = util.id.getID(object);
  }
}

/**
 * Removes an item from the filesystem store using its key and group ID.
 */
function del(config, callback) {

}

/**
 * Reads and deserializes an item from the local file system. The callback must be valid
 * and the global store path must be available.
 */
function getItem(key, callback) {
  const path = `${global.nodeInfo.storePath}/${encodeKey(key)}.json`;
  fs.readFile(path, "utf8", (error, data) => {
    if (error) {
      callback(error, null);
      return;
    }
    try {
      callback(null, util.deserialize(data));
    } catch (error) {
      callback(error, null);
    }
  });
}

/**
 * Serializes and saves an object to the local file system. The callback must be valid
 * and the global store path must be available.
 */
function saveItem(config, callback) {

}

/**
 * Removes an item from the local file system. The callback must be valid and the global
 * store path must be available.
 */
function deleteItem(config, callback) {

}

/**
 * Reads and decodes the keys of all the items in the local file system. The callback must
 * be valid and the global store path must be available.
 */
function getAllKeys(callback) {
  // Find all the keys in the filesystem
  fs.readdir(global.nodeInfo.storePath, {withFileTypes: true}, (error, items) => {
    if (error) {
      callback(error, null);
      return;
    }
    const keys = items
        .filter((i) => i.isFile() && i.name.endsWith(".json"))
        .map((f) => decodeKey(f.name.slice(0, -5)));
    callback(null, keys);
  });
}

/**
 * Encodes a string key in base 64.
 */
function encodeKey(key) {

}

/**
 * Decodes a string key in base 64.
 */
function decodeKey(key) {

}

module.exports = {get, put, del};
