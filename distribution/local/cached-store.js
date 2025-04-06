/* A cached key-value store built on the filesystem store module. The clear operation
   is not supported. Keys that are cached cannot be accessed by other store modules. */

const store = require("./store.js");
const params = require("../params.js");
const util = require("../util/util.js");

const NOT_FOUND_MARK = params.notFoundMark;

const cache = util.cache.createCache(20000);

/**
 * Retrieves a value from the cache or loads the value into the cache.
 */
function get(config, callback) {
  if (callback === undefined) {
    return;
  }
  const cacheKey = serializeKey(config);
  if (cacheKey instanceof Error) {
    callback(cacheKey, null);
    return;
  }

  if (cache.has(cacheKey)) {
    callback(null, cache.get(cacheKey));
    return;
  }
  loadItem(config, cacheKey, (error, exists, object) => {
    if (error) {
      callback(error, null);
    } else if (!exists) {
      callback(new Error("Key not found"));
    } else {
      callback(null, object);
    }
  });
}

/**
 * Optionally retrieves a value from the cache or loads the value into the cache.
 */
function tryGet(config, callback) {
  if (callback === undefined) {
    return;
  }
  const cacheKey = serializeKey(config);
  if (cacheKey instanceof Error) {
    callback(cacheKey, null);
    return;
  }

  if (cache.has(cacheKey)) {
    callback(null, true, cache.get(cacheKey));
    return;
  }
  loadItem(config, cacheKey, (error, exists, object) => {
    if (error) {
      callback(error, null, null);
    } else {
      callback(null, exists, object);
    }
  });
}

/**
 * Modifies a cached value that is written back when evicted.
 */
function put(object, config, callback) {
  callback = callback === undefined ? (error, result) => {} : callback;
  const cacheKey = serializeKey(config);
  if (cacheKey instanceof Error) {
    callback(cacheKey, null);
    return;
  }
  cacheItem(cacheKey, object, callback);
}

/**
 * Removes an item from the cache and the store.
 */
function del(config, callback) {
  callback = callback === undefined ? (error, result) => {} : callback;
  const cacheKey = serializeKey(config);
  if (cacheKey instanceof Error) {
    callback(cacheKey, null);
    return;
  }

  store.del(config, (error, object) => {
    let removed = null;
    if (cache.has(cacheKey)) {
      removed = cache.del(cacheKey);
    }

    if (error) {
      if (error[NOT_FOUND_MARK] && removed !== null) {
        callback(null, removed.value);
      } else {
        callback(error, null);
      }
    } else if (removed !== null) {
      callback(null, removed.value);
    } else {
      callback(null, object);
    }
  });
}

/**
 * Loads a key into the cache and possibly evicts the least recently used key.
 */
function loadItem(config, cacheKey, callback) {
  if (callback === undefined) {
    throw new Error("Load item received no callback");
  }

  store.tryGet(config, (error, exists, object) => {
    // Check error conditions
    if (error) {
      callback(error, null, null);
      return;
    } else if (!exists) {
      callback(null, false, null);
      return;
    }

    // Add key-value pair to cache
    cacheItem(cacheKey, object, (error, result) => {
      if (error) {
        callback(error, null, null);
      } else {
        callback(null, true, object);
      }
    });
  });
}

/**
 * Inserts a key-value pair into the cache and handles evictions.
 */
function cacheItem(cacheKey, object, callback) {
  if (callback === undefined) {
    throw new Error("Cache item received no callback");
  }

  // Insert the object into the cache
  const evicted = cache.put(cacheKey, object);
  if (evicted === null) {
    callback(null, object);
    return;
  }

  // Write back an evicted item
  const storeConfig = deserializeKey(evicted.key);
  store.put(evicted.value, storeConfig, callback);
}

/**
 * Flushes modifications made to an item in the cache to storage.
 */
function flush(config, callback) {
  callback = callback === undefined ? (error, result) => {} : callback;
  const cacheKey = serializeKey(config);
  if (cacheKey instanceof Error) {
    callback(cacheKey, null);
    return;
  }

  if (!cache.has(cacheKey)) {
    callback(null, null);
    return;
  }
  const storeConfig = deserializeKey(cacheKey);
  const object = cache.get(cacheKey);
  store.put(object, storeConfig, callback);
}

/**
 * Converts an object configuration into a cache key.
 */
function serializeKey(config) {
  config = util.id.getObjectConfig(config);
  if (config.key === null) {
    return new Error("Null keys are not supported");
  }
  return JSON.stringify(config);
}

/**
 * Converts a cache key into an object configuration.
 */
function deserializeKey(cacheKey) {
  return JSON.parse(cacheKey);
}

/**
 * Returns the minimal synchronization identifier for a key.
 */
function _getSyncKey(key) {
  return store._getSyncKey(key);
}

module.exports = {get, tryGet, put, del, flush, _getSyncKey};
