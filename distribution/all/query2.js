/* A service that supports low-latency term lookups. */

const params = require("../params.js");
const remote = require("./remote-service.js");
const util = require("../util/util.js");

const GROUP = params.searchGroup;

function lookupTerms(terms, callback) {
  if (callback === undefined) {
    return;
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
