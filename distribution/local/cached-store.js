/* A cached key-value store built on the filesystem store module. The clear operation
   is not supported. Keys that are cached cannot be accessed by other store modules. */

const store = require("./sharded-store.js");
const params = require("../params.js");
const util = require("../util/util.js");

const NOT_FOUND_MARK = params.notFoundMark;

const cache = util.cache.createCache(20000);
const locks = {};

/**
 * Retrieves a value from the cache or loads the value into the cache.
 */
function get(config, callback) {
  if (callback === undefined) {
    return;
  }
  const keys = serializeKey(config);
  if (keys instanceof Error) {
    callback(keys, null);
    return;
  }

  if (cache.has(keys.cacheKey)) {
    callback(null, cache.get(keys.cacheKey).data);
    return;
  }
  loadItem(config, keys, (error, exists, object) => {
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
  const keys = serializeKey(config);
  if (keys instanceof Error) {
    callback(keys, null);
    return;
  }

  if (cache.has(keys.cacheKey)) {
    callback(null, true, cache.get(keys.cacheKey).data);
    return;
  }
  loadItem(config, keys, (error, exists, object) => {
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
  const keys = serializeKey(config);
  if (keys instanceof Error) {
    callback(keys, null);
    return;
  }
  cacheItem(keys, object, true, callback);
}

/**
 * Removes an item from the cache and the store. This function has a possible race condition with put,
 * but we currently do not use it so we ignore this error.
 */
function del(config, callback) {
  callback = callback === undefined ? (error, result) => {} : callback;
  const keys = serializeKey(config);
  if (keys instanceof Error) {
    callback(keys, null);
    return;
  }

  // Create lock for sync key
  if (!(keys.syncKey in locks)) {
    locks[keys.syncKey] = util.sync.createMutex();
  }
  const lock = locks[keys.syncKey];

  lock.lock(() => {
    store.del(config, (error, object) => {
      // Remove key from cache
      let removed = null;
      if (cache.has(keys.cacheKey)) {
        removed = cache.del(keys.cacheKey);
      }
      lock.unlock();

      // Check error conditions
      if (error) {
        if (error[NOT_FOUND_MARK] && removed !== null) {
          callback(null, removed.value.data);
        } else {
          callback(error, null);
        }
      } else if (removed !== null) {
        callback(null, removed.value.data);
      } else {
        callback(null, object);
      }
    });
  });
}

/**
 * Loads a key into the cache and possibly evicts the least recently used key.
 */
function loadItem(config, keys, callback) {
  if (callback === undefined) {
    throw new Error("Load item received no callback");
  }
  if (!(keys.syncKey in locks)) {
    locks[keys.syncKey] = util.sync.createMutex();
  }
  const lock = locks[keys.syncKey];

  lock.lock(() => {
    store.tryGet(config, (error, exists, object) => {
      // Check error conditions
      lock.unlock();
      if (error) {
        callback(error, null, null);
        return;
      } else if (!exists) {
        callback(null, false, null);
        return;
      }

      // Add key-value pair to cache
      cacheItem(keys, object, false, (error, result) => {
        if (error) {
          callback(error, null, null);
        } else {
          callback(null, true, object);
        }
      });
    });
  });
}

/**
 * Inserts a key-value pair into the cache and handles evictions.
 */
function cacheItem(keys, object, dirty, callback) {
  if (callback === undefined) {
    throw new Error("Cache item received no callback");
  }

  // Insert the object into the cache
  const evicted = cache.put(keys.cacheKey, {data: object, dirty});
  if (evicted === null || !evicted.value.dirty) {
    callback(null, object);
    return;
  }

  // Write back an evicted item
  const storeConfig = deserializeKey(evicted.key);
  const syncKey = store._getSyncKey(storeConfig);
  if (!(syncKey in locks)) {
    throw new Error(`Key '${syncKey}' does not have a lock`);
  }
  const lock = locks[syncKey];

  lock.lock(() => {
    // Check if the value has been reinserted
    let value = evicted.value.data;
    if (cache.has(evicted.key)) {
      const entry = cache.get(evicted.key);
      if (entry.dirty) {
        value = entry.data;
      } else {
        cache.put(evicted.key, {data: value, dirty: false});
      }
    }

    // Write the most updated value to storage
    store.put(value, storeConfig, (error, result) => {
      lock.unlock();
      callback(error, result);
    });
  });
}

/**
 * Flushes modifications made to an item in the cache to storage.
 */
function flush(config, callback) {
  callback = callback === undefined ? (error, result) => {} : callback;
  const keys = serializeKey(config);
  if (keys instanceof Error) {
    callback(keys, null);
    return;
  }

  // Get lock for sync key
  if (!(keys.syncKey in locks)) {
    throw new Error(`Key '${keys.syncKey} has no lock'`);
  }
  const lock = locks[keys.syncKey];

  // Write the item if it still exists
  lock.lock(() => {
    if (!cache.has(keys.cacheKey)) {
      lock.unlock();
      callback(null, null);
    } else {
      const value = cache.get(keys.cacheKey).data;
      store.put(value, config, (error, result) => {
        lock.unlock();
        callback(error, result);
      });
    }
  });
}

/**
 * Converts an object configuration into a cache key.
 */
function serializeKey(config) {
  config = util.id.getObjectConfig(config);
  if (config.key === null) {
    return new Error("Null keys are not supported");
  }
  return {
    cacheKey: JSON.stringify(config),
    syncKey: store._getSyncKey(config),
  };
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
function _getSyncKey(config) {
  return store._getSyncKey(config);
}

module.exports = {get, tryGet, put, del, flush, _getSyncKey};
