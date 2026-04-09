/**
 * Reference implementation of the M6 capstone operation sequence (instructor / CI).
 * Semantics must match assignment/m6-capstone/README.md and assignment/M6-SPEC.md (capstone section).
 */

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
          callback(null, {
            fluentCollect,
            sortByKey: sortOut,
            join: joinOut,
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
  return {
    fluentCollect: sortKeyValueRows(raw.fluentCollect),
    sortByKey: sortKeyValueRows(raw.sortByKey),
    join: sortKeyValueRows(raw.join),
  };
}

module.exports = {
  runCapstonePipeline,
  canonicalizeCapstoneResult,
  sortKeyValueRows,
};
