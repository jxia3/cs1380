/* Manages the RPCs available on a node. RPC functions are stored in a mapping
   keyed by unique string IDs. */

const log = require("../util/log.js");

const rpcFns = {};
let rpcCount = 0;

/**
 * Creates a local RPC function and returns the stub. Note that external nodes can
 * only create RPC functions that are stateless.
 */
function create(fn, callback) {
  try {
    const stub = _createRPC(fn);
    callback(null, stub);
  } catch (error) {
    callback(error, null);
  }
}

/**
 * Calls an RPC function and returns the result.
 */
function call(id, ...args) {
  if (id in rpcFns) {
    rpcFns[id](...args);
    return;
  }
  try {
    args[args.length - 1](new Error(`RPC '${id}' not found`), null);
  } catch (error) {
    log(`RPC call to '${id}' failed: ${error.message}`);
  }
}

/**
 * Deletes an RPC function.
 */
function rem(id, callback) {
  let fn = null;
  if (id in rpcFns) {
    fn = rpcFns[id];
    delete rpcFns[id];
  }
  if (callback !== undefined) {
    callback(null, fn);
  }
}

/**
 * Registers an RPC function and creates an RPC stub. This internal function does
 * not accept a callback and should not be called by external services.
 */
function _createRPC(fn) {
  // Register RPC function
  const id = rpcCount.toString();
  log(`Creating RPC function with ID ${id}`);
  rpcCount += 1;
  rpcFns[id] = fn;

  // Create RPC stub
  function stub(...args) {
    const remote = {
      node: "__NODE_INFO__",
      service: "rpc",
      method: "call",
    };
    const callback = args.pop();
    args.unshift("__RPC_ID__");
    global.distribution.local.comm.send(args, remote, callback);
  }
  const nodeInfo = `{ ip: "${global.nodeConfig.ip}", port: ${global.nodeConfig.port} }`;
  const stubText = stub
      .toString()
      .replaceAll("\"__NODE_INFO__\"", nodeInfo)
      .replaceAll("\"__RPC_ID__\"", `"${id}"`);

  return (new Function(`return ${stubText}`))();
}

module.exports = {create, call, rem, _createRPC};
