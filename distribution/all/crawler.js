/** @typedef {import("../types").Callback} Callback */
/** @typedef {import("../types").Group} Group */

/* A service that handles crawler requests for a node group. */

const util = require("../util/util.js");
const remote = require("./remote-service.js");

/**
 * Distributes URLs to crawl across the node group.
 * @param {string[]} urls
 * @param {Callback} callback
 */
function crawl(urls, callback) {
  checkContext(this.gid, this.hash);
  callback = callback === undefined ? (error, result) => {} : callback;
  global.distribution.local.groups.get(this.gid, (error, group) => {
    if (error) {
      callback(error, null);
      return;
    }
    const batches = batchURLs.call(this, group, urls);
    queueBatches(group, batches, callback);
  });
}

/**
 * Splits a set of URLs into batches for each node.
 * @param {Group} group
 * @param {string[]} urls
 * @returns {Object} An object where key is node and value is array of URLs for that node.
 */
function batchURLs(group, urls) {
  const batches = {};
  for (const url of urls) {
    const node = util.id.applyHash(url, group, this.hash);
    if (!(node in batches)) {
      batches[node] = [];
    }
    batches[node].push(url);
  }
  return batches;
}

/**
 * Given URL batches, update crawl queues for relevant nodes.
 * @param {Group} group
 * @param {Object} batches An object where key is node and value is array of URLs for that node.
 * @param {Callback} callback
 * @returns {void}
 */
function queueBatches(group, batches, callback) {
  const errors = {};
  const results = {};
  let active = Object.keys(batches).length;
  if (active === 0) {
    callback(errors, results);
    return;
  }

  for (const node in batches) {
    // URLs for the node
    const urls = batches[node];
    const remote = {node: group[node], service: "crawler", method: "queueURLs"};
    global.distribution.local.comm.send([urls], remote, (error, result) => {
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
  return {crawl: crawl.bind(context)};
};
