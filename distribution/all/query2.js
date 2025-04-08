/* A service that supports low-latency term lookups. */

const params = require("../params.js");
const remote = require("./remote-service.js");
const util = require("../util/util.js");

const GROUP = params.searchGroup;

const cache = util.cache.createCache(20000);

/**
 * Routes remote requests to get the data associated with each term and caches the data.
 */
function lookupTerms(terms, callback) {
  checkContext(this.gid, this.hash);
  if (callback === undefined) {
    return;
  }

  global.distribution.local.groups.get(this.gid, (error, group) => {
    if (error) {
      callback(error, null);
      return;
    }
    const results = {};

    // Compute request batches
    const batches = {};
    for (const term of terms) {
      if (cache.has(term.text)) {
        results[term.text] = cache.get(term.text);
        continue;
      }
      const termKey = util.search.createFullTermKey(term.text);
      const node = util.id.applyHash(termKey, group, this.hash);
      if (!(node in batches)) {
        batches[node] = [];
      }
      batches[node].push({term: term.text, key: termKey});
    }

    console.log(batches);
  });
}

/**
 * Checks if the current function context is valid.
 */
function checkContext(groupId, hashFn) {
  if (groupId !== GROUP) {
    throw new Error(`Invalid search group '${groupId}'`);
  }
  remote.checkGroup(groupId);
  if (typeof hashFn !== "function") {
    throw new Error("Invalid search hash function");
  }
}

module.exports = (config) => {
  const context = {};
  context.gid = config?.gid === undefined ? "all" : config.gid;
  context.hash = config?.hash;
  if (typeof context.hash !== "function") {
    context.hash = util.id.rendezvousHash;
  }
  return {lookupTerms: lookupTerms.bind(context)};
};
