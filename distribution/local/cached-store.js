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

  loadItem(config, cacheKey, (error, object) => {
    if (error) {
      callback(error, null);
    } else {
      callback(null, object);
    }
  });
}

function tryGet(config, callback) {}

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
    global.distribution.local.store.get(config, (error, object) => {
      // Return early on error
      locks[cacheKey].unlock();
      if (error) {
        callback(error, null);
        return;
      }

      // Insert the object into the cache
      const evicted = cache.put(cacheKey, object);
      if (evicted === null) {
        callback(null, object);
        return;
      }

      // Write back an evicted item
      locks[evicted].lock(() => {
        global.distribution.local.store.put(deserializeKey(evicted), (error, result) => {
          locks[evicted].unlock();
          if (error) {
            callback(error, null);
          } else {
            callback(null, object);
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
