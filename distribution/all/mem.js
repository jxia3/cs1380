/* A service that stores key-value pairs in memory distributed across a group. */

const util = require("../util/util.js");

/**
 * Retrieves an item from group in-memory store using its key.
 */
function get(config, callback) {

}

/**
 * Inserts an item into the group in-memory store. If a key is not specified, then the
 * SHA256 hash of the object serialized as JSON is used.
 */
function put(config, callback) {

}

/**
 * Removes an item from the group in-memory store using its key.
 */
function del(config, callback) {

}

/**
 * Rebalances items across a group when membership is changed.
 */
function reconf(config, callback) {

}

module.exports = (config) => {
  const context = {};
  context.gid = config?.gid === undefined ? "all" : config.gid;
  context.hash = config?.hash;
  if (typeof context.hash !== "function") {
    context.hash = util.id.naiveHash;
  }

  return {
    get: get.bind(context),
    put: put.bind(context),
    del: del.bind(context),
    reconf: reconf.bind(context),
  };
};
