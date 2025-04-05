/* A sharded key-value store built on the filesystem store module. */

const store = require("./store.js");
const util = require("../util/util.js");

const SHARD_COUNT = 10;

// Keys to store directly instead of translating to shards
const EXCLUDE_LIST = ["seen-urls", "crawl-queue", "index-queue"];

/**
 * Finds the shard containing a key and returns the value corresponding to the key.
 */
function get(config, callback) {
  if (callback === undefined) {
    return;
  }
  config = util.id.getObjectConfig(config);
  if (EXCLUDE_LIST.includes(config.key)) {
    store.get(config, callback);
    return;
  }

  store.tryGet(getShardConfig(config), (error, exists, shard) => {
    if (error) {
      callback(error, null);
    } else if (!exists || !(config.key in shard)) {
      callback(new Error(`Key '${config.key}' not found`), null);
    } else {
      callback(null, shard[config.key]);
    }
  });
}

/**
 * Finds the shard containing a key and optionally returns the value corresponding to the key.
 */
function tryGet(config, callback) {
  if (callback === undefined) {
    return;
  }
  config = util.id.getObjectConfig(config);
  if (EXCLUDE_LIST.includes(config.key)) {
    store.tryGet(config, callback);
    return;
  }

  store.tryGet(getShardConfig(config), (error, exists, shard) => {
    if (error) {
      callback(error, null);
    } else {
      if (exists && config.key in shard) {
        callback(null, true, shard[config.key]);
      } else {
        callback(null, false, null);
      }
    }
  });
}

/**
 * Adds a key-value pair to its corresponding shard.
 */
function put(object, config, callback) {
  callback = callback === undefined ? (error, result) => {} : callback;
  config = util.id.getObjectConfig(config);
  if (EXCLUDE_LIST.includes(config.key)) {
    store.put(object, config, callback);
    return;
  }

  const shardConfig = getShardConfig(config);
  store.tryGet(shardConfig, (error, exists, shard) => {
    if (error) {
      callback(error, null);
      return;
    }
    if (!exists) {
      shard = {};
    }
    shard[config.key] = object;
    store.put(shard, shardConfig, (error, result) => {
      if (error) {
        callback(error, null);
      } else {
        callback(null, object);
      }
    });
  });
}

/**
 * Removes a key-value pair from its corresponding shard.
 */
function del(config, callback) {
  callback = callback === undefined ? (error, result) => {} : callback;
  config = util.id.getObjectConfig(config);
  if (EXCLUDE_LIST.includes(config.key)) {
    store.del(config, callback);
    return;
  }

  const shardConfig = getShardConfig(config);
  store.tryGet(shardConfig, (error, exists, shard) => {
    if (error) {
      callback(error, null);
      return;
    } else if (!exists || !(config.key in shard)) {
      callback(new Error(`Key '${config.key}' not found`), null);
      return;
    }

    const object = shard[config.key];
    delete shard[config.key];
    const storeCallback = (error, result) => {
      if (error) {
        callback(error, null);
      } else {
        callback(null, object);
      }
    };
    if (Object.keys(shard).length > 0) {
      store.put(shard, shardConfig, storeCallback);
    } else {
      store.del(shardConfig, storeCallback);
    }
  });
}

/**
 * Converts a key configuration to a sharded configuration.
 */
function getShardConfig(config) {
  return {
    key: getShardKey(config.key),
    gid: config.gid,
  };
}

/**
 * Hashes a key to find the key of the shard shard it belongs to.
 */
function getShardKey(key) {
  const keyId = util.id.getID(key);
  const shard = parseInt(keyId.slice(0, 13), 16) % SHARD_COUNT;
  return `[shard]-${shard}`;
}

/**
 * Returns the minimal synchronization identifier for a key.
 */
function _getSyncKey(key) {
  return getShardKey(key);
}

module.exports = {get, tryGet, put, del, _getSyncKey};
