/* A sharded key-value store built on the filesystem store module. */

const store = require("./store.js");
const util = require("../util/util.js");

const SHARD_AMOUNT = 10;

// Store these keys directly instead of sharding
const EXCLUDE_LIST = ["seen-urls", "crawl-queue", "index-queue"];

/**
 * Given a key, find the shard containing the key,
 * and return the corresponding value of the key.
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
  
  // Translate the key to its shard
  const shard = getShard(config.key);
  store.tryGet(shard, (error, exists, shardResult) => {
    if (error) {
      callback(error, null);
    } else if (!exists) {
      callback(new Error("Did not find the shard for the key"));
    } else {
      if (config.key in shardResult) {
        callback(null, shardResult[config.key]);
      } else {
        callback(new Error("Key does not exist in store"));
      }
    }
  });
}

/**
 * Given a key, find the shard containing the key,
 * and return the corresponding value of the key.
 */
function tryGet(config, callback) {
  if (callback === undefined) {
    return;
  }
  config = util.id.getObjectConfig(config);
  if (config.key in EXCLUDE_LIST) {
    store.tryGet(config, callback);
    return;
  }

  // Translate the key to its shard
  const shard = getShard(config.key);
  store.tryGet(shard, (error, exists, shardResult) => {
    if (error) {
      callback(error, null, null);
    } else {
      if (exists && (config.key in shardResult)) {
        callback(null, true, shardResult[config.key]);
      } else {
        callback(null, false, null);
      }
    }
  });
}

/**
 * Adds a key-value pair from its corresponding shard.
 */
function put(object, config, callback) {
  if (callback === undefined) {
    return;
  }
  config = util.id.getObjectConfig(config);
  if (config.key in EXCLUDE_LIST) {
    store.put(object, config, callback);
    return;
  }

  // Translate the key to its shard
  const shard = getShard(config.key);
  store.tryGet(shard, (error, exists, shardResult) => {
    if (error) {
      callback(error, null);
    } else {
      if (!exists) {
        shardResult = {};
      }
      shardResult[config.key] = object;
      store.put(shardResult, shard, (error, result) => {
        if (error) {
          callback(error, null);
        } else {
          callback(null, result);
        }
      })
    }
  });
}

/**
 * Removes a key-value pair from its corresponding shard.
 */
function del(config, callback) {
  if (callback === undefined) {
    return;
  }
  config = util.id.getObjectConfig(config);
  if (config.key in EXCLUDE_LIST) {
    store.del(config, callback);
    return;
  }

  // Translate the key to its shard
  const shard = getShard(config.key);
  store.tryGet(shard, (error, exists, shardResult) => {
    if (error) {
      callback(error, null);
    } else {
      if (exists) {
        if (config.key in shardResult) {
          delete shardResult[config.key];
        }
        if (Object.keys(shardResult).length === 0) {
          store.del(shard, callback);
        } else {
          store.put(shardResult, shard, callback);
        }
      }
    }
  });
}

/**
 * Converts a hexademical hash to a integer in the range [0, rangeSize - 1].
 */
function idToNumRange(hash, rangeSize) {
  const shortHash = hash.slice(0, 13);
  const decimalVal = parseInt(shortHash, 16);
  return decimalVal % rangeSize;
}

/**
 * Hashes a key to its shard name
 */
function getShard(key) {
  const keyID = util.id.getID(key);
  const shard = idToNumRange(keyID, SHARD_AMOUNT);
  return `shard-${shard}`;
}

/**
 * Used by atomic-store to determine which key to synchronize 
 */
function _getSyncKey(key) {
  return getShard(key);
}

module.exports = {get, tryGet, put, del, _getSyncKey};