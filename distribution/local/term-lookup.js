/* A service that supports low-latency term lookups. */

const params = require("../params.js");
const util = require("../util/util.js");

const GROUP = params.searchGroup;
const ONLY_WORDS = true;

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
          const text = util.search.recoverFullTerm(term);
          if (!ONLY_WORDS || text.split(" ").length === 1) {
            terms.push({
              text,
              count: Object.keys(shardData[term]).length,
              score: Object.values(shardData[term])
                  .map(util.search.decompressEntry)
                  .map((e) => e.score)
                  .reduce((a, b) => a + b, 0),
            });
          }
        }

        active -= 1;
        if (active === 0) {
          terms.sort((a, b) => {
            if (a.count !== b.count) {
              return b.count - a.count;
            }
            return b.score - a.score;
          });
          callback(null, terms.slice(0, limit));
        }
      });
    }
  });
}

module.exports = {lookup, calcMostFrequent};
