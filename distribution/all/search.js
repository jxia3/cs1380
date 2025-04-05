/* A service that coordinates crawling and indexing across a node group. */

const remote = require("./remote-service.js");
const util = require("../util/util.js");

const GROUP = util.search.GROUP;

/**
 * Sets a node as the orchestrator node and starts all the search loops.
 */
function start(node, reset, callback) {
  checkContext(this.gid, this.hash);
  callback = callback === undefined ? (error, result) => {} : callback;
  if (node?.ip === undefined || node?.port === undefined) {
    callback(new Error("Invalid orchestrator node"), null);
    return;
  }
  if (this.orchestrator !== undefined) {
    callback(new Error("Group is already initialized"), null);
    return;
  }
  this.orchestrator = node;
  const service = {service: "search", method: "start"};
  global.distribution[this.gid].comm.send([reset], service, callback);
}

/**
 * Updates the search statistics on the orchestrator node.
 */
function updateCounts(crawled, indexed, callback) {
  checkContext(this.gid, this.hash);
  callback = callback === undefined ? (error, result) => {} : callback;
  if (this.orchestrator === undefined) {
    callback(new Error("Group is not initialized"), null);
    return;
  }
  const remote = {node: this.orchestrator, service: "search", method: "updateCounts"};
  global.distribution.local.comm.send([crawled, indexed], remote, callback);
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

module.exports = {start, updateCounts};
