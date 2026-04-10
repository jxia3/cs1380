/**
 * M6 Performance Benchmark
 *
 * Measures end-to-end latency for Spark operations across dataset sizes and worker counts.
 * Includes narrow chains plus reduceByKey, groupByKey, distinct, sortByKey, join, leftOuterJoin, union.
 * Writes p6-results.html at the repository root (next to package.json).
 *
 * Run: TIMEOUT=180 ./scripts/run-test.sh m6/p6.js
 * Or: node m6/p6.js (ports 1234, 2000-2002 must be free)
 *
 * Env: SIZES="100,500,1000" NODES="1,2,3" RUNS=2 node m6/p6.js
 *      P6_VERBOSE=1  log progress lines; default is quiet (only final path + errors)
 *      P6_OP_TIMEOUT_MS=180000  max time per op per run (default 3m; avoids infinite hang)
 */

const fs = require("fs");
const path = require("path");
const {generateP6Html} = require("./p6-html.js");
const log = require("../distribution/util/log.js");
log.disable();
const distribution = require("../distribution.js");

const VERBOSE = process.env.P6_VERBOSE === "1";
/** Max ms for one benchmark invocation (each RUNS repeat gets its own deadline). */
const OP_TIMEOUT_MS = Math.max(1000, parseInt(process.env.P6_OP_TIMEOUT_MS || "180000", 10) || 180000);

const basePort = 2000;
const maxWorkers = 3;

const SIZES = (process.env.SIZES || "100,500,1000,2000,5000").split(",").map(Number).filter(Boolean);
const NODE_COUNTS = (process.env.NODES || "1,2,3").split(",").map(Number).filter(Boolean);
const RUNS = parseInt(process.env.RUNS || "2", 10) || 2;

function padKey(i, n) {
  const w = Math.max(1, String(n - 1).length);
  return "k" + String(i).padStart(w, "0");
}

function generateKeys(n) {
  const keys = [];
  const w = String(n - 1).length;
  for (let i = 0; i < n; i++) {
    keys.push(padKey(i, n));
  }
  return keys;
}

function loadData(keys, done) {
  let cnt = 0;
  if (keys.length === 0) return done();
  keys.forEach((key) => {
    const value = "v" + key.slice(1);
    distribution.test.store.put(value, key, () => {
      cnt++;
      if (cnt === keys.length) done();
    });
  });
}

function timeOp(fn, cb) {
  const times = [];
  let run = 0;
  let lastErr = null;
  let aborted = false;

  function finish(err, mean) {
    if (aborted) return;
    aborted = true;
    cb(err, mean);
  }

  function doRun() {
    if (aborted) return;
    const start = Date.now();
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      lastErr = new Error(`Benchmark operation exceeded ${OP_TIMEOUT_MS}ms (set P6_OP_TIMEOUT_MS)`);
      finish(lastErr, null);
    }, OP_TIMEOUT_MS);

    fn((err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (aborted) return;
      if (err) lastErr = err;
      else times.push(Date.now() - start);
      run++;
      if (run < RUNS) doRun();
      else {
        if (lastErr) {
          finish(lastErr, null);
          return;
        }
        const mean = times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : null;
        finish(null, mean);
      }
    });
  }
  doRun();
}

function runBenchmarksForConfig(spark, keys, n, ops, cb) {
  const keysA = keys.slice(0, Math.floor(n / 2));
  const keysB = keys.slice(Math.floor(n / 4), Math.floor(3 * n / 4));
  const opList = [
    { name: "collect", run: (d) => spark.collect(keys, (e) => d(e)) },
    { name: "count", run: (d) => spark.count(keys, (e) => d(e)) },
    { name: "map+collect", run: (d) => spark.fromKeys(keys).map((k, v) => ({[k]: v.toUpperCase()})).collect((e) => d(e)) },
    { name: "filter+collect", run: (d) => spark.fromKeys(keys).filter((k) => k.startsWith("k0") || k.startsWith("k1")).collect((e) => d(e)) },
    { name: "flatMap+collect", run: (d) => spark.fromKeys(keys).flatMap((k, v) => v.split("").map((c) => ({[c]: 1}))).collect((e) => d(e)) },
    {
      name: "reduceByKey",
      run: (d) => spark.reduceByKey({
        keys,
        map: (key, value) => [{[String(value)]: 1}],
        reduce: (key, values) => ({[key]: values.reduce((a, b) => a + b, 0)}),
      }, (e) => d(e)),
    },
    { name: "groupByKey", run: (d) => spark.groupByKey(keys, (e) => d(e)) },
    { name: "distinct", run: (d) => spark.distinct(keys, (e) => d(e)) },
    { name: "sortByKey", run: (d) => spark.sortByKey(keys, (e) => d(e)) },
    { name: "join", run: (d) => spark.join(keysA, keysB, (e) => d(e)) },
    { name: "leftOuterJoin", run: (d) => spark.leftOuterJoin(keysA, keysB, (e) => d(e)) },
    { name: "union", run: (d) => spark.union(keysA, keysB, (e) => d(e)) },
  ].filter((o) => !ops || ops.includes(o.name));

  let idx = 0;
  const out = {};
  function next() {
    if (idx >= opList.length) return cb(null, out);
    const op = opList[idx];
    timeOp(op.run, (err, mean) => {
      if (err) return cb(err);
      out[op.name] = mean;
      idx++;
      next();
    });
  }
  next();
}

let spawnedWorkers = 0;

function runPhase(workerCount, allResults, cb) {
  const nodes = [];
  for (let i = 0; i < workerCount; i++) {
    nodes.push({
      ip: "127.0.0.1",
      port: basePort + i,
      _disableLogs: true,
    });
  }

  function spawnNext(i, done) {
    if (i >= workerCount) return done();
    if (i < spawnedWorkers) return spawnNext(i + 1, done);
    distribution.local.status.spawn(nodes[i], () => {
      spawnedWorkers = Math.max(spawnedWorkers, i + 1);
      spawnNext(i + 1, done);
    });
  }

  spawnNext(0, () => {
    const groupConfig = {gid: "test", hash: distribution.util.id.consistentHash};
    const nodeList = [global.nodeConfig, ...nodes];
    distribution.local.groups.put(groupConfig, nodeList, (err) => {
      if (err) return cb(err);
      distribution.test.groups.put(groupConfig, nodeList, (errors) => {
        if (errors && Object.keys(errors).length > 0) return cb(new Error("groups put failed"));

        allResults[workerCount] = {};
        let sizeIdx = 0;

        function runNextSize() {
          if (sizeIdx >= SIZES.length) return cb();
          const n = SIZES[sizeIdx];
          const keys = generateKeys(n);
          if (VERBOSE) process.stdout.write(`  n=${n} (${workerCount}w)... `);
          loadData(keys, () => {
            runBenchmarksForConfig(distribution.test.spark, keys, n, null, (err, opResults) => {
              if (err) {
                console.error(err);
                return cb(err);
              }
              allResults[workerCount][n] = opResults;
              if (VERBOSE) console.log(Object.values(opResults).join("/") + " ms");
              sizeIdx++;
              runNextSize();
            });
          });
        }
        runNextSize();
      });
    });
  });
}

function main() {
  const allResults = {};
  let phaseIdx = 0;

  function runNextPhase() {
    if (phaseIdx >= NODE_COUNTS.length) {
      const outPath = path.join(__dirname, "..", "p6-results.html");
      fs.writeFileSync(
        outPath,
        generateP6Html(allResults, {sizes: SIZES, nodeCounts: NODE_COUNTS, runs: RUNS}),
        "utf8"
      );
      console.log("\nResults written to", outPath);
      process.exit(0);
      return;
    }
    const wc = NODE_COUNTS[phaseIdx];
    if (VERBOSE) console.log(`\n--- ${wc} worker(s) ---`);
    runPhase(wc, allResults, (err) => {
      if (err) {
        console.error(err);
        process.exit(1);
      }
      phaseIdx++;
      runNextPhase();
    });
  }

  runNextPhase();
}

global.nodeConfig._disableLogs = true;

distribution.node.start(() => {
  main();
});
