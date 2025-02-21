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
    // Read serialized object from local file
    const path = `${global.nodeInfo.storePath}/${config.key}.json`;
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
  } else {
    // Find all the keys in the filesystem
    fs.readdir(global.nodeInfo.storePath, {withFileTypes: true}, (error, items) => {
      if (error) {
        callback(error, null);
        return;
      }
      const keys = items
          .filter((i) => i.isFile() && i.name.endsWith(".json"))
          .map((f) => f.name.slice(0, -5));
      callback(null, keys);
    });
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
