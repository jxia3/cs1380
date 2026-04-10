/**
 * Reference implementation of the M6 capstone operation sequence (instructor / CI).
 * Semantics must match assignment/m6-capstone/README.md and assignment/M6-SPEC-CAPSTONE.md (capstone section).
 */

/** Top-level keys in expected.json / student output (order not significant). */
const CAPSTONE_OUTPUT_KEYS = [
  "fluentCollect",
  "sortByKey",
  "join",
  "groupByKey",
  "reduceByKey",
];

/**
 * @param {object} spark - spark service for the test group
 * @param {object} data - parsed data.json
 * @param {function(Error|null, object|null): void} callback
 */
function runCapstonePipeline(spark, data, callback) {
  const allKeys = data.records.map((r) => r.key).sort();

  spark
    .fromKeys(allKeys)
    .filter((key, value) => typeof value === "string" && !value.includes("SKIP"))
    .map((key, value) => ({[key]: String(value).trim().toUpperCase()}))
    .flatMap((key, value) => [{[key]: value}, {[key]: value}])
    .filter((key, value) => String(value).length >= 5)
    .collect((err, fluentCollect) => {
      if (err) {
        callback(err, null);
        return;
      }
      spark.sortByKey(data.keysForSort, {ascending: true}, (err2, sortOut) => {
        if (err2) {
          callback(err2, null);
          return;
        }
        spark.join(data.keysJoinA, data.keysJoinB, (err3, joinOut) => {
          if (err3) {
            callback(err3, null);
            return;
          }
          spark.groupByKey(data.keysForGroupByKey, (err4, groupOut) => {
            if (err4) {
              callback(err4, null);
              return;
            }
            spark.reduceByKey(
              {
                keys: data.keysForReduceByKey,
                map: (key, value) => [{[key]: 1}],
                reduce: (key, values) => ({[key]: values.reduce((a, b) => a + b, 0)}),
              },
              (err5, reduceOut) => {
                if (err5) {
                  callback(err5, null);
                  return;
                }
                callback(null, {
                  fluentCollect,
                  sortByKey: sortOut,
                  join: joinOut,
                  groupByKey: groupOut,
                  reduceByKey: reduceOut,
                });
              }
            );
          });
        });
      });
    });
}

/**
 * Stable sort of arrays of single-key objects for comparison (and expected file).
 * @param {object[]} rows
 * @returns {object[]}
 */
function sortKeyValueRows(rows) {
  if (!Array.isArray(rows)) return rows;
  return [...rows].sort((a, b) => rowSortKey(a).localeCompare(rowSortKey(b)));
}

function rowSortKey(row) {
  if (!row || typeof row !== "object") return "";
  const k = Object.keys(row)[0];
  return k + "\0" + JSON.stringify(row[k]);
}

/**
 * @param {object} raw - output of runCapstonePipeline
 * @returns {object}
 */
function canonicalizeCapstoneResult(raw) {
  const out = {};
  for (const key of CAPSTONE_OUTPUT_KEYS) {
    out[key] = sortKeyValueRows(raw[key]);
  }
  return out;
}

module.exports = {
  CAPSTONE_OUTPUT_KEYS,
  runCapstonePipeline,
  canonicalizeCapstoneResult,
  sortKeyValueRows,
};
