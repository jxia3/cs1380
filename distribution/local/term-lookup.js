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

module.exports = {lookup};
