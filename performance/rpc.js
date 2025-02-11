/* A script that measures the throughput and latency of the communication module
   and the RPC module. Performance is averaged over 1,000 requests sent in a loop.
   Because we are interested in measuring network time, computationally inexpensive
   workloads are used for the requests. */

const distribution = require("../config.js");

const {performance} = require("perf_hooks");

const local = distribution.local;
const node = distribution.node;
const util = distribution.util;

if (distribution.disableLogs) {
  distribution.disableLogs();
}

function add(a, b, callback) {
  callback(null, a + b);
}
const addStub = util.wire.createRPC(add);

/* A control function that performs no operations. */
function control(iter, callback) {
  callback();
}

/* Sends a communication request to the local node. */
function communicationRequest(iter, callback) {
  const remote = {node: node.config, service: "status", method: "get"};
  local.comm.send(["counts"], remote, (error, result) => {
    if (error) {
      throw error;
    }
    if (result !== iter) {
      throw new Error(`Expected count ${iter} but received ${result}`);
    }
    callback();
  });
}

/* Sends an RPC request to the local node. */
function rpcRequest(iter, callback) {
  addStub(iter, iter + 1, (error, result) => {
    if (error) {
      throw error;
    }
    if (result !== 2 * iter + 1) {
      throw new Error(`Expected value ${2 * iter + 1} but received ${result}`);
    }
    callback();
  });
}

node.start((server) => {
  measurePerformance(control, 1000, () => {
    console.log("Control test done\n");
    measurePerformance(communicationRequest, 1000, () => {
      console.log("Communication test done\n");
      measurePerformance(rpcRequest, 100, () => {
        console.log("RPC test done\n");
        server.close();
      });
    });
  });
});

/* Measures the throughput and latency of an asynchronous function that accepts a
   callback. The function is run over a number of iterations. */
function measurePerformance(fn, iters, callback) {
  let totalLatency = 0;
  const startTime = performance.now();
  loop(iters);

  function loop(iter) {
    if (iter === 0) {
      endTest();
      return;
    }
    const iterStart = performance.now();
    fn(iters - iter + 1, () => {
      totalLatency += performance.now() - iterStart;
      loop(iter - 1);
    });
  }

  function endTest() {
    const totalTime = performance.now() - startTime;
    console.log("Throughput:", iters / totalTime);
    console.log("Average latency:", totalLatency / iters);
    callback();
  }
}
