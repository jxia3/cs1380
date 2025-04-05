/* A cached key-value store built on the filesystem store module. The clear operation
   is not supported. Keys that are cached cannot be accessed by other store modules. */

const util = require("../util/util.js");

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

function put(object, config, callback) {}

function del(config, callback) {}

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
    global.distribution.local.store.tryGet(config, (error, exists, object) => {
      // Check error conditions
      locks[cacheKey].unlock();
      if (error) {
        callback(error, null, null);
        return;
      } else if (!exists) {
        callback(null, false, null);
        return;
      }

      // Insert the object into the cache
      const evicted = cache.put(cacheKey, object);
      if (evicted === null) {
        callback(null, true, object);
        return;
      }

      // Write back an evicted item
      locks[evicted.key].lock(() => {
        const storeConfig = deserializeKey(evicted.key);
        global.distribution.local.store.put(evicted.value, storeConfig, (error, result) => {
          locks[evicted.key].unlock();
          if (error) {
            callback(error, null, null);
          } else {
            callback(null, true, object);
          }
        });
      });
    });
  });
}

/**
 * Converts an object configuration into a cache key.
 */
function serializeKey(config) {
  config = util.id.getObjectConfig(config);
  return JSON.stringify(config);
}

/**
 * Converts a cache key into an object configuration.
 */
function deserializeKey(cacheKey) {
  return JSON.parse(cacheKey);
}

module.exports = {get, tryGet, put, del};
