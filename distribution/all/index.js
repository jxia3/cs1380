/* A service that batches and routes index update requests across a node group group. */

const remote = require("./remote-service.js");
const util = require("../util/util.js");

/**
 * Distributes update index requests across the node group.
 */
function updateIndex(url, terms, docLen, callback) {
  checkContext(this.gid, this.hash);
  callback = callback === undefined ? (error, result) => {} : callback;
  console.log("ROUTING:");
  console.log(Object.keys(terms));
  process.exit(0);
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
  return {updateIndex: updateIndex.bind(context)};
};
