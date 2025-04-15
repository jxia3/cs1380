/* A service that coordinates crawling and indexing across a node group. */

const params = require("../params.js");
const remote = require("./remote-service.js");
const util = require("../util/util.js");

const GROUP = params.searchGroup;
const DEBUG = params.debug;

/**
 * Sets a node as the orchestrator node and starts all the search cycles.
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
  global.distribution[this.gid].comm.send([node, reset], service, callback);
}

/**
 * Stops the search cycles on all the nodes.
 */
function stop(callback) {
  checkContext(this.gid, this.hash);
  const service = {service: "search", method: "stop"};
  global.distribution[this.gid].comm.send([], service, callback);
}

/**
 * Flushes the local caches on all the nodes.
 */
function flushCache(callback) {
  checkContext(this.gid, this.hash);
  const service = {service: "search", method: "flushCache"};
  global.distribution[this.gid].comm.send([], service, callback);
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
 * Updates crawler-specific stats on orchestrator node.
 */
function updateQueryStats(queries, time, callback) {
  checkContext(this.gid, this.hash);
  callback = callback === undefined ? (error, result) => {} : callback;
  if (!DEBUG) {
    callback(null, null);
    return;
  }
  if (this.orchestrator === undefined) {
    callback(new Error("Group is not initialized"), null);
    return;
  }
  const remote = {node: this.orchestrator, service: "search", method: "updateCrawlerStats"};
  global.distribution.local.comm.send([queries, time], remote, callback);
}

/**
 * Updates crawler-specific stats on orchestrator node.
 */
function updateCrawlerStats(ignoredURL, irrelevantURL, pageContentLength, callback) {
  checkContext(this.gid, this.hash);
  callback = callback === undefined ? (error, result) => {} : callback;
  if (!DEBUG) {
    callback(null, null);
    return;
  }
  if (this.orchestrator === undefined) {
    callback(new Error("Group is not initialized"), null);
    return;
  }
  const remote = {node: this.orchestrator, service: "search", method: "updateCrawlerStats"};
  global.distribution.local.comm.send([ignoredURL, irrelevantURL, pageContentLength], remote, callback);
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
  return {
    start: start.bind(context),
    stop: stop.bind(context),
    flushCache: flushCache.bind(context),
    updateCounts: updateCounts.bind(context),
    updateQueryStats: updateQueryStats.bind(context),
    updateCrawlerStats: updateCrawlerStats.bind(context),
    _setOrchestrator: (node) => context.orchestrator = node,
  };
};
