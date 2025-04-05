/* A cached key-value store built on the filesystem store module. The clear operation
   is not supported. Keys that are cached cannot be accessed by other store modules. */

const store = require("./store.js");
const util = require("../util/util.js");

const NotFoundError = store.NotFoundError;

const cache = util.cache.createCache(10000);
const locks = {};

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
      callback(new Error("Key does not exist in store"));
    } else {
      callback(null, object);
    }
  });
}

/**
 * Retrieves a value from the cache or loads the value into the cache.
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

  if (cache.has(cacheKey)) {
    cacheItem(cacheKey, object, callback);
    return;
  }
  loadItem(config, cacheKey, (error, exists, prevObject) => {
    if (error) {
      callback(error, null);
    } else {
      cacheItem(cacheKey, object, callback);
    }
  });
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

  if (!(cacheKey in locks)) {
    locks[cacheKey] = util.sync.createMutex();
  }
  locks[cacheKey].lock(() => {
    store.del(config, (error, result) => {
      let removed = null;
      if (cache.has(cacheKey)) {
        removed = cache.del(cacheKey);
      }
      locks[cacheKey].unlock();

      if (error) {
        if (error instanceof NotFoundError && removed !== null) {
          callback(null, removed.value);
        } else {
          callback(error, null);
        }
      } else if (removed !== null) {
        callback(null, removed.value);
      } else {
        callback(null, result);
      }
    });
  });
}

/**
 * Loads a key into the cache and possibly evicts the least recently used key.
 */
function loadItem(config, cacheKey, callback) {
  if (callback === undefined) {
    throw new Error("Load item received no callback");
  }
  if (!(cacheKey in locks)) {
    locks[cacheKey] = util.sync.createMutex();
  }

  locks[cacheKey].lock(() => {
    store.tryGet(config, (error, exists, object) => {
      // Check error conditions
      if (error) {
        locks[cacheKey].unlock();
        callback(error, null, null);
        return;
      } else if (!exists) {
        locks[cacheKey].unlock();
        callback(null, false, null);
        return;
      }

      // Add key-value pair to cache
      cacheItem(cacheKey, object, (error, result) => {
        locks[cacheKey].unlock();
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
function cacheItem(cacheKey, object, callback) {
  if (callback === undefined) {
    throw new Error("Cache item received no callback");
  }
  if (!(cacheKey in locks)) {
    locks[cacheKey] = util.sync.createMutex();
  }

  // Insert the object into the cache
  const evicted = cache.put(cacheKey, object);
  if (evicted === null) {
    callback(null, object);
    return;
  }

  // Write back an evicted item
  locks[evicted.key].lock(() => {
    const storeConfig = deserializeKey(evicted.key);
    store.put(evicted.value, storeConfig, (error, result) => {
      locks[evicted.key].unlock();
      if (error) {
        callback(error, null);
      } else {
        callback(null, object);
      }
    });
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
  return JSON.stringify(config);
}

/**
 * Converts a cache key into an object configuration.
 */
function deserializeKey(cacheKey) {
  return JSON.parse(cacheKey);
}

module.exports = {get, tryGet, put, del};
