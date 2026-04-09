#!/usr/bin/env node
/**
 * Regenerate assignment/m6-capstone/expected.json using the local spark implementation.
 * Instructor / CI use. Requires free ports (see scripts/kill-ports.sh).
 *
 * Usage: node m6/generate-capstone-expected.js
 */

const fs = require("fs");
const path = require("path");

const log = require("../distribution/util/log.js");
log.disable();

const distribution = require("../distribution.js");
const {runCapstonePipeline, canonicalizeCapstoneResult} = require(
  path.join(__dirname, "..", "assignment", "m6-capstone", "reference-pipeline.js")
);

const dataPath = path.join(__dirname, "..", "assignment", "m6-capstone", "data.json");
const outPath = path.join(__dirname, "..", "assignment", "m6-capstone", "expected.json");

const data = JSON.parse(fs.readFileSync(dataPath, "utf8"));

const basePort = 2150;
const nodes = [
  {ip: "127.0.0.1", port: basePort},
  {ip: "127.0.0.1", port: basePort + 1},
  {ip: "127.0.0.1", port: basePort + 2},
];

function loadRecords(done) {
  let cnt = 0;
  const {records} = data;
  records.forEach((row) => {
    distribution.test.store.put(row.value, row.key, () => {
      cnt++;
      if (cnt === records.length) {
        done();
      }
    });
  });
}

function runAfterSpawn() {
  const groupConfig = {gid: "test", hash: distribution.util.id.consistentHash};
  const nodeList = [global.nodeConfig, ...nodes];

  distribution.local.groups.put(groupConfig, nodeList, (err) => {
    if (err) {
      console.error(err);
      process.exit(1);
    }
    distribution.test.groups.put(groupConfig, nodeList, (errors) => {
      if (errors && Object.keys(errors).length > 0) {
        console.error(errors);
        process.exit(1);
      }
      loadRecords(() => {
        const spark = distribution.test.spark;
        runCapstonePipeline(spark, data, (e, result) => {
          if (e) {
            console.error(e);
            process.exit(1);
          }
          const canon = canonicalizeCapstoneResult(result);
          fs.writeFileSync(outPath, `${JSON.stringify(canon, null, 2)}\n`, "utf8");
          console.log("Wrote", outPath);
          process.exit(0);
        });
      });
    });
  });
}

distribution.node.start(() => {
  distribution.local.status.spawn(nodes[0], () => {
    distribution.local.status.spawn(nodes[1], () => {
      distribution.local.status.spawn(nodes[2], () => {
        runAfterSpawn();
      });
    });
  });
});
