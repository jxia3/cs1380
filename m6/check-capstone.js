#!/usr/bin/env node
/**
 * Compare a student capstone output JSON to assignment/m6-capstone/expected.json.
 * Student file must have keys fluentCollect, sortByKey, join (arrays).
 * Rows are canonicalized the same way as the reference generator.
 *
 * Usage: node m6/check-capstone.js path/to/output.json
 */

const fs = require("fs");
const path = require("path");
const {canonicalizeCapstoneResult} = require(
  path.join(__dirname, "..", "assignment", "m6-capstone", "reference-pipeline.js")
);

const expectedPath = path.join(__dirname, "..", "assignment", "m6-capstone", "expected.json");
const studentPath = process.argv[2];

if (!studentPath) {
  console.error("Usage: node m6/check-capstone.js <output.json>");
  process.exit(2);
}

const expected = JSON.parse(fs.readFileSync(expectedPath, "utf8"));
let student;
try {
  student = JSON.parse(fs.readFileSync(studentPath, "utf8"));
} catch (e) {
  console.error("Could not read or parse student file:", e.message);
  process.exit(1);
}

for (const k of ["fluentCollect", "sortByKey", "join"]) {
  if (!Array.isArray(student[k])) {
    console.error(`Missing or invalid array: ${k}`);
    process.exit(1);
  }
}

const canon = canonicalizeCapstoneResult(student);

if (JSON.stringify(canon) !== JSON.stringify(expected)) {
  console.error("Output does not match expected.json after canonicalization.");
  process.exit(1);
}

console.log("OK: matches expected.json");
process.exit(0);
