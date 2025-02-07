const log = require("./log.js");

/* Adds an RPC call for a local function. The function must accept a callback parameter. */
function createRPC(func) {
  // Write some code...
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
