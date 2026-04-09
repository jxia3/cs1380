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

function generateHTML(results) {
  const ops = [
    "collect", "count", "map+collect", "filter+collect", "flatMap+collect",
    "reduceByKey", "groupByKey", "distinct", "sortByKey", "join", "leftOuterJoin", "union",
  ];
  const colors = ["#2563eb", "#16a34a", "#dc2626", "#9333ea"];
  const nodeColors = NODE_COUNTS.reduce((a, n, i) => ({...a, [n]: colors[i % colors.length]}), {});

  const w = 400;
  const h = 220;
  const pad = { left: 50, right: 20, top: 20, bottom: 40 };
  const plotW = w - pad.left - pad.right;
  const plotH = h - pad.top - pad.bottom;

  function scaleX(x, min, max) {
    return pad.left + (x - min) / (max - min || 1) * plotW;
  }
  function scaleY(y, min, max) {
    return pad.top + plotH - (y - min) / (max - min || 1) * plotH;
  }

  function lineChart(op, dataByNodes) {
    const sizes = SIZES.filter((s) => dataByNodes[NODE_COUNTS[0]]?.[s] != null);
    if (sizes.length === 0) return "";
    const allVals = NODE_COUNTS.flatMap((nc) => sizes.map((s) => dataByNodes[nc]?.[s]).filter(Boolean));
    const minY = 0;
    const maxY = Math.max(...allVals, 1);
    const minX = Math.min(...sizes);
    const maxX = Math.max(...sizes);

    let svg = `<svg width="${w}" height="${h}" style="border:1px solid #e5e7eb;margin:4px;">`;
    svg += `<text x="${w/2}" y="12" text-anchor="middle" font-size="11" font-weight="bold">${op}</text>`;
    svg += `<line x1="${pad.left}" y1="${pad.top}" x2="${pad.left}" y2="${pad.top + plotH}" stroke="#9ca3af" stroke-width="1"/>`;
    svg += `<line x1="${pad.left}" y1="${pad.top + plotH}" x2="${pad.left + plotW}" y2="${pad.top + plotH}" stroke="#9ca3af" stroke-width="1"/>`;

    NODE_COUNTS.forEach((nc) => {
      const pts = sizes.map((s) => {
        const v = dataByNodes[nc]?.[s];
        return v != null ? `${scaleX(s, minX, maxX)},${scaleY(v, minY, maxY)}` : null;
      }).filter(Boolean);
      if (pts.length > 1) {
        svg += `<polyline points="${pts.join(" ")}" fill="none" stroke="${nodeColors[nc]}" stroke-width="2"/>`;
      }
      if (pts.length >= 1) {
        pts.forEach((pt) => {
          const [cx, cy] = pt.split(",");
          svg += `<circle cx="${cx}" cy="${cy}" r="4" fill="${nodeColors[nc]}" stroke="#fff" stroke-width="1"/>`;
        });
      }
    });

    sizes.forEach((s) => {
      const x = scaleX(s, minX, maxX);
      svg += `<text x="${x}" y="${h - 5}" text-anchor="middle" font-size="9" fill="#6b7280">${s}</text>`;
    });
    svg += `<text x="${pad.left - 5}" y="${pad.top + 8}" text-anchor="end" font-size="9" fill="#6b7280">${maxY}ms</text>`;
    svg += `</svg>`;
    return svg;
  }

  function scalingChart() {
    const op = "collect";
    const dataByNodes = {};
    NODE_COUNTS.forEach((nc) => {
      dataByNodes[nc] = {};
      SIZES.forEach((s) => {
        const v = results[nc]?.[s]?.[op];
        if (v != null) dataByNodes[nc][s] = v;
      });
    });
    const sizes = SIZES.filter((s) => results[NODE_COUNTS[0]]?.[s]?.[op] != null);
    if (sizes.length === 0) return "";
    const allVals = NODE_COUNTS.flatMap((nc) => sizes.map((s) => results[nc]?.[s]?.[op]).filter(Boolean));
    const maxY = Math.max(...allVals, 1);
    const minX = Math.min(...sizes);
    const maxX = Math.max(...sizes);

    let svg = `<svg width="${w}" height="${h}" style="border:1px solid #e5e7eb;margin:4px;">`;
    svg += `<text x="${w/2}" y="12" text-anchor="middle" font-size="11" font-weight="bold">Scaling: collect (latency vs size)</text>`;
    svg += `<line x1="${pad.left}" y1="${pad.top}" x2="${pad.left}" y2="${pad.top + plotH}" stroke="#9ca3af" stroke-width="1"/>`;
    svg += `<line x1="${pad.left}" y1="${pad.top + plotH}" x2="${pad.left + plotW}" y2="${pad.top + plotH}" stroke="#9ca3af" stroke-width="1"/>`;

    NODE_COUNTS.forEach((nc) => {
      const pts = sizes.map((s) => {
        const v = results[nc]?.[s]?.[op];
        return v != null ? `${scaleX(s, minX, maxX)},${scaleY(v, 0, maxY)}` : null;
      }).filter(Boolean);
      if (pts.length > 1) {
        svg += `<polyline points="${pts.join(" ")}" fill="none" stroke="${nodeColors[nc]}" stroke-width="2"/>`;
      }
      if (pts.length >= 1) {
        pts.forEach((pt) => {
          const [cx, cy] = pt.split(",");
          svg += `<circle cx="${cx}" cy="${cy}" r="4" fill="${nodeColors[nc]}" stroke="#fff" stroke-width="1"/>`;
        });
      }
    });

    sizes.forEach((s) => {
      const x = scaleX(s, minX, maxX);
      svg += `<text x="${x}" y="${h - 5}" text-anchor="middle" font-size="9" fill="#6b7280">${s}</text>`;
    });
    svg += `</svg>`;
    return svg;
  }

  const legend = NODE_COUNTS.map((nc) => `<span style="color:${nodeColors[nc]}">■</span> ${nc} worker(s)`).join(" &nbsp; ");

  let html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>M6 Performance Results</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 24px; background: #f9fafb; }
    h1 { color: #111827; }
    .meta { color: #6b7280; margin-bottom: 20px; }
    .chart-grid { display: flex; flex-wrap: wrap; gap: 8px; }
    .chart-section { margin: 20px 0; }
    .chart-section h2 { font-size: 14px; color: #374151; margin-bottom: 8px; }
    table { border-collapse: collapse; margin: 16px 0; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    th, td { padding: 10px 14px; text-align: right; }
    th { background: #f3f4f6; font-weight: 600; }
    td:first-child, th:first-child { text-align: left; }
    tr:nth-child(even) { background: #f9fafb; }
  </style>
</head>
<body>
  <h1>M6 Performance Benchmark</h1>
  <div class="meta">Sizes: ${SIZES.join(", ")} | Workers: ${NODE_COUNTS.join(", ")} | Runs: ${RUNS} | Legend: ${legend}</div>

  <div class="chart-section">
    <h2>Latency vs Dataset Size (by operation)</h2>
    <div class="chart-grid">`;

  ops.forEach((op) => {
    const fixed = {};
    NODE_COUNTS.forEach((nc) => {
      fixed[nc] = {};
      SIZES.forEach((s) => {
        const v = results[nc]?.[s]?.[op];
        if (v != null) fixed[nc][s] = v;
      });
    });
    html += lineChart(op, fixed);
  });

  html += `
    </div>
  </div>

  <div class="chart-section">
    <h2>Scaling: More Workers Reduce Latency</h2>
    <div class="chart-grid">
      ${scalingChart()}
    </div>
  </div>

  <div class="chart-section">
    <h2>Raw Data (ms)</h2>
    <table>
      <thead><tr><th>Workers</th><th>Size</th>${ops.map((o) => `<th>${o}</th>`).join("")}</tr></thead>
      <tbody>`;

  NODE_COUNTS.forEach((nc) => {
    SIZES.forEach((s) => {
      const row = results[nc]?.[s];
      if (row) {
        html += `<tr><td>${nc}</td><td>${s}</td>${ops.map((o) => `<td>${row[o] ?? "-"}</td>`).join("")}</tr>`;
      }
    });
  });

  html += `
      </tbody>
    </table>
  </div>
</body>
</html>`;

  return html;
}

function main() {
  const allResults = {};
  let phaseIdx = 0;

  function runNextPhase() {
    if (phaseIdx >= NODE_COUNTS.length) {
      const outPath = path.join(__dirname, "..", "p6-results.html");
      fs.writeFileSync(outPath, generateHTML(allResults), "utf8");
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
