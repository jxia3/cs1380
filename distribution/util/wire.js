const log = require("./log.js");
const rpc = require("../local/rpc.js");

let rpcCount = 0;

/* Adds an RPC call for a local function. The function must accept a callback parameter. */
function createRPC(fn) {
  // Register RPC function
  const id = rpcCount.toString();
  log(`Creating RPC function with ID ${id}`);
  rpcCount += 1;
  rpc.put(fn, id, (error, result) => {
    // Safety: it is guaranteed that the call is synchronous so there is no race condition
    if (error) {
      throw error;
    }
  });

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
