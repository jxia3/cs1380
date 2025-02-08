/* A script that measures the throughput and latency of the communication module
   and the RPC module. Performance is averaged over 1,000 requests sent in a loop.
   Because we are interested in measuring network time, computationally inexpensive
   workloads are used for the requests. */

const distribution = require("../config.js");

const {performance} = require("perf_hooks");

const local = distribution.local;
const util = distribution.util;