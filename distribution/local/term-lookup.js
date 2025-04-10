/* A service that supports low-latency term lookups. */

const params = require("../params.js");

const GROUP = params.searchGroup;

/**
 * Looks up an ordered array of terms in the local cached store.
 */
function lookup(termKeys, callback) {
  if (callback === undefined) {
    return;
  }
  const results = new Array(termKeys.length).fill(null);
  let active = termKeys.length;

  const storeModule = global.distribution.local.atomicStore._store;
  for (let k = 0; k < termKeys.length; k += 1) {
    const config = {gid: GROUP, key: termKeys[k]};
    storeModule.get(config, (error, result) => {
      if (!error) {
        results[k] = result;
      }
      active -= 1;
      if (active === 0) {
        callback(null, results);
      }
    });
  }
}

/**
 * Computes the most frequent terms from each the local store.
 */
function calcMostFrequent(limit, callback) {
  if (callback === undefined) {
    return;
  }

  global.distribution.local.store.get({gid: GROUP, key: null}, (error, shards) => {
    if (error) {
      callback(error, null);
      return;
    }
    const terms = [];
    let active = shards.length;

    for (const shard of shards) {
      global.distribution.local.store.get({gid: GROUP, key: shard}, (error, shardData) => {
        if (error) {
          return;
        }
        for (const term in shardData) {
          terms.push({
            text: term,
            count: Object.keys(shardData[term]).length,
          });
        }

        active -= 1;
        if (active === 0) {
          terms.sort((a, b) => b.count - a.count);
          callback(null, terms.slice(0, limit));
        }
      });
    }
  });}

module.exports = {lookup, calcMostFrequent};
