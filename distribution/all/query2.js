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
        batches[node] = {
          keys: [],
          terms: [],
        };
      }
      batches[node].keys.push(termKey);
      batches[node].terms.push(term.text);
    }

    // Send requests
    if (Object.keys(batches).length === 0) {
      callback(null, results);
      return;
    }
    lookupBatches(group, batches, (error, batchResults) => {
      if (error) {
        callback(error, null);
        return;
      }
      for (const term in batchResults) {
        results[term] = batchResults[term];
      }
      callback(null, results);
    });
  });
}

/**
 * Sends requests with batches of terms to remote nodes.
 */
function lookupBatches(group, batches, callback) {
  const results = {};
  let active = Object.keys(batches).length;
  if (active === 0) {
    throw new Error("Cannot lookup an empty batch");
  }

  for (const node in batches) {
    const remote = {node: group[node], service: "query2", method: "lookup"};
    global.distribution.local.comm.send([batches[node].keys], remote, (error, result) => {
      if (error) {
        console.error(error);
        return;
      }

      for (let r = 0; r < result.length; r += 1) {
        results[batches[node].terms[r]] = result[r];
      }
      active -= 1;
      if (active === 0) {
        callback(null, results);
      }
    });
  }
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
