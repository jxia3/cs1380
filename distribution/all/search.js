/* A service that coordinates crawling and indexing across a node group. */

const remote = require("./remote-service.js");
const util = require("../util/util.js");

const GROUP = util.search.GROUP;

function start(node, reset, callback) {
  checkContext(this.gid, this.hash);
  callback = callback === undefined ? (error, result) => {} : callback;
  if (node?.ip === undefined || node?.port === undefined) {
    callback(new Error("Invalid orchestrator node"), null);
  }
  if (this.orchestrator !== undefined) {
    callback(new Error("Group is already initialized"), null);
  }
  this.orchestrator = node;
}

function updateCounts(crawled, indexed, callback) {}

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
