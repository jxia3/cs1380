const local = require("../local/local.js");
const log = require("./log.js");

let rpcCount = 0;

/* Adds an RPC call for a local function. The function must accept a callback parameter. */
function createRPC(fn) {
  // Register RPC function
  const id = rpcCount.toString();
  log(`Creating RPC function with ID ${id}`);
  rpcCount += 1;
  local.rpc.putInternal(fn, id);

  // Create RPC stub
  if (fn.toString().includes("__NODE_INFO__")) {
    throw new Error("Function includes internal node token");
  }
  function stub(...args) {
    const remote = {
      node: "__NODE_INFO__",
      service: "rpc",
      method: "call",
    };
    const callback = args.pop();
    global.distribution.local.comm.send(args, remote, callback);
  }

  return stub;
}

/* Converts a synchronous function that returns a value to an asynchronous function that
   accepts a callback. The return value is passed into the callback. */
function toAsync(fn) {
  function asyncFn(...args) {
    if (args.length < fn.length + 1) {
      throw new Error("Called an asynchronous function with insufficient argments");
    }
    const callback = args.pop();
    if (callback === undefined) {
      throw new Error("Called an asynchronous function without a callback");
    }
    try {
      const result = fn(...args);
      callback(null, result);
    } catch (error) {
      callback(error, null);
    }
  }
  asyncFn.toString = () => fn.toString();
  return asyncFn;
}

module.exports = {
  createRPC: createRPC,
  toAsync: toAsync,
};
