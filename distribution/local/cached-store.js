/* A cached key-value store built on the filesystem store module. The clear operation
   is not supported. Keys that are cached cannot be accessed by other store modules. */

const log = require("../util/log.js");
const params = require("../params.js");
const util = require("../util/util.js");

const NOT_FOUND_MARK = params.notFoundMark;

/**
 * Retrieves a value from the cache or loads the value into the cache.
 */
function get(config, callback) {
  if (callback === undefined) {
    return;
  }
  const keys = serializeKey.call(this, config);
  if (keys instanceof Error) {
    callback(keys, null);
    return;
  }

  if (this.cache.has(keys.cacheKey)) {
    callback(null, this.cache.get(keys.cacheKey).data);
    return;
  }
  loadItem.call(this, config, keys, (error, exists, object) => {
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
  const keys = serializeKey.call(this, config);
  if (keys instanceof Error) {
    callback(keys, null);
    return;
  }

  if (this.cache.has(keys.cacheKey)) {
    callback(null, true, this.cache.get(keys.cacheKey).data);
    return;
  }
  loadItem.call(this, config, keys, (error, exists, object) => {
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
  const keys = serializeKey.call(this, config);
  if (keys instanceof Error) {
    callback(keys, null);
    return;
  }
  cacheItem.call(this, keys, object, true, callback);
}

/**
 * Removes an item from the cache and the store. This function has a possible race condition with put,
 * but we currently do not use it so we ignore this error.
 */
function del(config, callback) {
  callback = callback === undefined ? (error, result) => {} : callback;
  const keys = serializeKey.call(this, config);
  if (keys instanceof Error) {
    callback(keys, null);
    return;
  }

  // Create lock for sync key
  if (!(keys.syncKey in this.locks)) {
    this.locks[keys.syncKey] = util.sync.createMutex();
  }
  const lock = this.locks[keys.syncKey];

  lock.lock(() => {
    this.store.del(config, (error, object) => {
      // Remove key from cache
      let removed = null;
      if (this.cache.has(keys.cacheKey)) {
        removed = this.cache.del(keys.cacheKey);
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
  if (!(keys.syncKey in this.locks)) {
    this.locks[keys.syncKey] = util.sync.createMutex();
  }
  const lock = this.locks[keys.syncKey];

  lock.lock(() => {
    this.store.tryGet(config, (error, exists, object) => {
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
      cacheItem.call(this, keys, object, false, (error, result) => {
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
  const evicted = this.cache.put(keys.cacheKey, {data: object, dirty});
  if (evicted === null || !evicted.value.dirty) {
    callback(null, object);
    return;
  }

  // Write back an evicted item
  const storeConfig = deserializeKey(evicted.key);
  const syncKey = this.store._getSyncKey(storeConfig);
  if (!(syncKey in this.locks)) {
    throw new Error(`Key '${syncKey}' does not have a lock`);
  }
  const lock = this.locks[syncKey];

  lock.lock(() => {
    // Check if the value has been reinserted
    let value = evicted.value.data;
    if (this.cache.has(evicted.key)) {
      const entry = this.cache.get(evicted.key);
      if (entry.dirty) {
        value = entry.data;
      } else {
        this.cache.put(evicted.key, {data: value, dirty: false});
      }
    }

    // Write the most updated value to storage
    this.store.put(value, storeConfig, (error, result) => {
      lock.unlock();
      callback(error, result);
    });
  });
}

/**
 * Flushes all the items in the cache to storage.
 */
function flush(callback) {
  callback = callback === undefined ? (error, result) => {} : callback;
  const keys = this.cache.getKeys();
  const count = keys.length;
  let active = keys.length;
  log(`Flushing ${count} keys to storage`, "cache");

  let flushError = null;
  for (const key of keys) {
    const config = deserializeKey(key);
    flushItem.call(this, config, (error, result) => {
      if (error) {
        flushError = error;
      }
      active -= 1;
      if (active === 0) {
        callback(flushError, null);
      }
    });
  }
}

/**
 * Flushes modifications made to an item in the cache to storage.
 */
function flushItem(config, callback) {
  callback = callback === undefined ? (error, result) => {} : callback;
  const keys = serializeKey.call(this, config);
  if (keys instanceof Error) {
    callback(keys, null);
    return;
  }

  // Get lock for sync key
  if (!(keys.syncKey in this.locks)) {
    throw new Error(`Key '${keys.syncKey} has no lock'`);
  }
  const lock = this.locks[keys.syncKey];

  // Write the item if it still exists
  lock.lock(() => {
    if (this.cache.has(keys.cacheKey)) {
      const value = this.cache.get(keys.cacheKey).data;
      this.store.put(value, config, (error, result) => {
        lock.unlock();
        callback(error, result);
      });
    } else {
      lock.unlock();
      callback(null, null);
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
    syncKey: this.store._getSyncKey(config),
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
  return this.store._getSyncKey(config);
}

module.exports = (store, capacity) => {
  const context = {
    store,
    cache: util.cache.createCache(capacity),
    locks: {},
  };
  return {
    get: get.bind(context),
    tryGet: tryGet.bind(context),
    put: put.bind(context),
    del: del.bind(context),
    flush: flush.bind(context),
    _getSyncKey: _getSyncKey.bind(context),
  };
};
