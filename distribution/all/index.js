/* A service that batches and routes index update requests across a node group. */

const remote = require("./remote-service.js");
const util = require("../util/util.js");

/**
 * Distributes update index requests across the node group.
 */
function updateIndex(url, terms, docLen, callback) {
  checkContext(this.gid, this.hash);
  callback = callback === undefined ? (error, result) => {} : callback;
  global.distribution.local.groups.get(this.gid, (error, group) => {
    if (error) {
      callback(error, null);
      return;
    }
    const batches = calcBatches.call(this, group, url, terms, docLen);
    sendBatches(group, url, batches, docLen, callback);
  });
}

/**
 * Splits a set of terms into batches for each node.
 */
function calcBatches(group, url, terms, docLen) {
  const batches = {};
  for (const term in terms) {
    const node = util.id.applyHash(term, group, this.hash);
    if (!(node in batches)) {
      batches[node] = {};
    }
    batches[node][term] = terms[term];
  }
  return batches;
}

/**
 * Sends batches of index updates across a node group. The callback must be valid.
 */
function sendBatches(group, url, batches, docLen, callback) {
  const errors = {};
  const results = {};
  let active = Object.keys(batches).length;
  if (active === 0) {
    callback(errors, results);
    return;
  }

  for (const node in batches) {
    const args = [url, batches[node], docLen];
    const remote = {node: group[node], service: "index", method: "updateIndex"};
    global.distribution.local.comm.send(args, remote, (error, result) => {
      if (error) {
        errors[node] = error;
      } else {
        results[node] = result;
      }
      active -= 1;
      if (active === 0) {
        callback(errors, results);
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
  return {updateIndex: updateIndex.bind(context)};
};
