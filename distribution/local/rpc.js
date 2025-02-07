/* Manages the RPCs available on a node. RPC functions are stored in a mapping
   keyed by unique string IDs. */

const log = require("../util/log.js");

const rpcFns = {};

/* Retrieves a registered RPC function. */
function get(config, callback) {
  if (callback === undefined) {
    return;
  }
  if (config in rpcFns) {
    callback(null, rpcFns[config]);
  } else {
    callback(new Error(`RPC '${config}' not found`), null);
  }
}

/* Registers an RPC function. */
function put(fn, config, callback) {
  rpcFns[config] = fn;
  if (callback !== undefined) {
    callback(null, fn);
  }
}

/* Deletes an RPC function. */
function rem(config, callback) {
  let fn = null;
  if (config in rpcFns) {
    fn = rpcFns[config];
    delete rpcFns[config];
  }
  if (callback !== undefined) {
    callback(null, fn);
  }
}

/* Calls an RPC function. */
function call(config, ...args) {
  if (config in rpcFns) {
    rpcFns(config)(...args);
  } else if (args.length > 0) {
    try {
      args[args.length - 1](new Error(`RPC '${config}' not found`), null);
    } catch (error) {
      log(`RPC call to '${config}' failed: ${error.message}`);
    }
  }
}

module.exports = {call, get, put, rem};
