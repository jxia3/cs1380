/* A service that stores key-value pairs in the local file system. */

const util = require("../util/util.js");

const fs = require("fs");

/**
 * An error that indicates if an item is not found in the store.
 */
class NotFoundError extends Error {
  constructor(...args) {
    super(...args);
  }
}

/**
 * Retrieves an item from the file system store using its key and group ID.
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
    getItem(config, callback);
  } else {
    getAllKeys(config, callback);
  }
}

/**
 * Retrieves an item from the file system store and returns if it exists.
 */
function tryGet(config, callback) {
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
  if (config.key === null) {
    callback(new Error("Cannot try to get all the keys"), null);
    return;
  }

  getItem(config, (error, object) => {
    if (error) {
      if (error instanceof NotFoundError) {
        callback(null, false, null);
      } else {
        callback(error, null, null);
      }
    } else {
      callback(null, true, object);
    }
  });
}

/**
 * Inserts an item into the file system store. If a key is not specified, then the SHA256
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
  saveItem(config, object, callback);
}

/**
 * Removes an item from the file system store using its key and group ID.
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

  if (global?.nodeInfo?.storePath === undefined) {
    callback(new Error("Store path not available"), null);
    return;
  }
  deleteItem(config, callback);
}

/**
 * Removes all the items in a group from the file system store.
 */
function clear(groupId, callback) {
  callback = callback === undefined ? (error, result) => {} : callback;
  if (groupId === undefined) {
    callback(new Error("Group not specified"), null);
    return;
  }

  if (global?.nodeInfo?.storePath === undefined) {
    callback(new Error("Store path not available"), null);
    return;
  }
  clearGroup(groupId, callback);
}

/**
 * Reads and deserializes an item from the local file system. The callback must be valid
 * and the global store path must be available.
 */
function getItem(config, callback) {
  const path = `${global.nodeInfo.storePath}/${config.gid}/${encodeKey(config.key)}.dat`;
  fs.access(path, (error) => {
    if (error) {
      callback(new NotFoundError(`Key '${config.key}' not found in group '${config.gid}'`), null);
      return;
    }
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
  });
}

/**
 * Serializes and saves an object to the local file system. The callback must be valid
 * and the global store path must be available.
 */
function saveItem(config, object, callback) {
  const groupDirectory = `${global.nodeInfo.storePath}/${config.gid}`;
  const path = `${groupDirectory}/${encodeKey(config.key)}.dat`;
  fs.mkdir(groupDirectory, {recursive: true}, (error, result) => {
    if (error) {
      callback(error, null);
      return;
    }
    fs.writeFile(path, util.serialize(object), "utf8", (error) => {
      if (error) {
        callback(error, null);
      } else {
        callback(null, object);
      }
    });
  });
}

/**
 * Removes an item from the local file system. The callback must be valid and the global
 * store path must be available.
 */
function deleteItem(config, callback) {
  const path = `${global.nodeInfo.storePath}/${config.gid}/${encodeKey(config.key)}.dat`;
  getItem(config, (error, object) => {
    if (error) {
      callback(error, null);
      return;
    }
    fs.unlink(path, (error) => {
      if (error) {
        callback(error, null);
      } else {
        callback(null, object);
      }
    });
  });
}

/**
 * Deletes a group directory in the local file system. The callback must be valid and the
 * global store path must be available.
 */
function clearGroup(groupId, callback) {
  const path = `${global.nodeInfo.storePath}/${groupId}`;
  fs.access(path, (error) => {
    if (error) {
      callback(new Error(`Directory for group '${groupId}' not found`), null);
      return;
    }
    fs.rm(path, {recursive: true}, (error) => {
      if (error) {
        callback(error, null);
        return;
      }
      callback(null, null);
    });
  });
}

/**
 * Reads and decodes the keys of all the items in the local file system. The callback must
 * be valid and the global store path must be available.
 */
function getAllKeys(config, callback) {
  const groupDirectory = `${global.nodeInfo.storePath}/${config.gid}`;
  fs.access(groupDirectory, (error) => {
    if (error) {
      callback(null, []);
      return;
    }
    fs.readdir(groupDirectory, {withFileTypes: true}, (error, items) => {
      if (error) {
        callback(error, null);
        return;
      }
      const keys = items
          .filter((i) => i.isFile() && i.name.endsWith(".dat"))
          .map((f) => decodeKey(f.name.slice(0, -4)));
      callback(null, keys);
    });
  });
}

/**
 * Encodes a string key to base 64.
 */
function encodeKey(key) {
  return Buffer.from(key, "utf8").toString("base64");
}

/**
 * Decodes a string key from base 64.
 */
function decodeKey(key) {
  return Buffer.from(key, "base64").toString("utf8");
}

// Used by atomic-store to determine which key to synchronize
function _getSyncKey(key) {
  return key;
}

module.exports = {NotFoundError, get, tryGet, put, del, clear, _getSyncKey};
