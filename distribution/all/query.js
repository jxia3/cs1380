const util = require("../util/util.js");
const remote = require("./remote-service.js");
const params = require("../params.js");

const GROUP = params.searchGroup;

/**
 * Distributes get term requests across the node group.
 */
function superDih(terms, callback) {
  checkContext(this.gid, this.hash);
  callback = callback === undefined ? (error, result) => {} : callback;
  global.distribution.local.groups.get(this.gid, (error, group) => {
    if (error) {
      callback(error, null);
      return;
    }
    const batches = calcBatches.call(this, group, terms);
    
    if (Object.keys(batches).length === 0) {
      callback(null, {});
      return;
    }
    getTerms(group, batches, callback);
  });
}

/**
 * Splits a set of terms into batches for each node.
 */
function calcBatches(group, terms) {
  const batches = {};
  for (const term of terms) {
    const text = util.search.createFullTermKey(term.text);
    const node = util.id.applyHash(text, group, this.hash);
    if (!(node in batches)) {
      batches[node] = [];
    }
    batches[node].push(term);
  }
  // console.log('bathces: ', batches);
  return batches;
}

/**
 * Gets term information across batches. The callback must be valid.
 */
function getTerms(group, batches, callback) {
  // const errors = {};
  const results = {};
  let active = Object.keys(batches).length;
  if (active === 0) {
    throw new Error("Cannot lookup an empty batch");
  }
  for (const node in batches) {
    const terms = []
    
    // create term list
    for (const term of batches[node]) {
      terms.push(`[${term.text}]-full`);
    }
    const remote = {node: group[node], service: "termLookup", method: "lookup"};
    global.distribution.local.comm.send([terms], remote, (error, result) => {
      if (error) {
        console.error(error);
        return;
      }

      // Decompress results
      for (let r = 0; r < result.length; r += 1) {
        const term = util.search.recoverFullTerm(terms[r]);
        results[term] = {}

        if (result[r] === null) {
          continue;
        }
        
        for (const url in result[r]) {
          results[term][url] = util.search.decompressEntry(result[r][url]);
        }
      }
      // Return to callback
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
  remote.checkGroup(groupId);
  if (typeof hashFn !== "function") {
    throw new Error("Invalid index hash function");
  }
}

module.exports = (config) => {
  const context = {};
  context.gid = config?.gid === undefined ? "all" : config.gid;
  context.hash = config?.hash;
  if (typeof context.hash !== "function") {
    context.hash = util.id.rendezvousHash;
  }
  return {superDih: superDih.bind(context)};
};
