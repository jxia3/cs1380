/* Manages the RPCs available on a node. RPC functions are stored in a mapping
   keyed by unique string IDs. */

const rpcFns = {};

/* Registers an RPC function. */
function put(fn, config, callback) {
  rpcFns[config] = fn;
  if (callback !== undefined) {
    callback(null, fn);
  }
}

module.exports = {put};
