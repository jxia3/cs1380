/* A sharded key-value store built on the filesystem store module. */

const store = require("./store.js");
const util = require("../util/util.js");

const SHARD_AMT = 10;

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
  if (config.key in EXCLUDE_LIST) {
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
      if (exists && (config.key in shardResult)) {
        delete shardResult[config.key];
      }
      store.put(shardResult, shard, (error, result) => {
        if (error) {
          callback(error, null);
        } else {
          callback(null, result);
        }
      });
    }
  });
}

/**
 * Converts a hexademical hash to a integer in the range [0, rangeSize - 1].
 */
function idToNumRange(hash, rangeSize) {
  if (typeof rangeSize !== 'number' || rangeSize <= 0 || 
      !Number.isInteger(rangeSize) || rangeSize >= Number.MAX_SAFE_INTEGER) {
    throw new Error("Invalid rangeSize provided. Must be a positive integer, and less than 2^53.");
  }
  if (typeof hash !== 'string') {
    throw new Error("Invalid hash, not a string");
  }

  try {
    // Only use 13 hex digits, corresponding to 2^53
    const shortHash = hash.slice(0, 13);
    const decimalVal = parseInt(shortHash, 16);
    return decimalVal % rangeSize;
  } catch (error) {
    throw new Error(`Integer conversion failed with '${error.message}'`);
  }
}

// Hashes a key to its shard name
function getShard(key) {
  const keyID = util.id.getID(key);
  const shard = idToNumRange(keyID, SHARD_AMT);
  return generateShardName(shard);
}

// Generate key name for shard files, given the shard number
function generateShardName(shard) {
  return `shard-${shard}`;
}

// Used by atomic-store to determine which key to synchronize
function _getSyncKey(key) {
  return getShard(key);
}

module.exports = {get, tryGet, put, del, _getSyncKey};