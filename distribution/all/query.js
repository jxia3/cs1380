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
    getTerms(group, batches, callback);
  });
}

/**
 * Splits a set of terms into batches for each node.
 */
function calcBatches(group, terms) {
  const batches = {};
  for (const term of terms) {
    const node = util.id.applyHash(term, group, this.hash);
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
  const errors = {};
  const results = {};
  let batchKeys = Object.keys(batches);
  let active = 0

  if (batchKeys.length === 0) {
    callback(errors, results);
  }

  for (const node in batches) {
    for (const term of batches[node]) {
      // console.log('term: ', term);

      // use create function thing
      const key = `[${term.text}]-full`;
      // console.log('key:', key);
      const remote = {node: group[node], service: "shardedStore", method: "get"};
      active++;
      global.distribution.local.comm.send([{gid: GROUP, key}], remote, (error, result) => {
        // console.log('result: ', result);
        if (error) {
          if (!(node in errors)) {
            errors[node] = [];
            results[term.text] = {};
          }
          errors[node].push(error);
        }
        else {
          results[term.text] = result;
        }
        active--;
        if (active == 0) {
          for (const result in results) {
            for (const url in results[result]) {
              results[result][url] = util.search.decompressEntry(results[result][url]);
            }
          }
          console.log("results: ", results);
          callback(errors, results);
        }  
      });
    }
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
