/** @typedef {import("../types").Callback} Callback */

/* Spark-inspired operations that extend the MapReduce framework.
   Provides filter, distinct, count, collect, and other transformations.
   User functions are inlined via util.compile so they serialize correctly. */

const remote = require("./remote-service.js");
const util = require("../util/util.js");

/**
 * Apply a function to each (key, value) pair; produce one output per input.
 * @param {string[]} keys
 * @param {function(key: any, value: any): object} mapFn - returns {[key]: value}
 * @param {Callback} callback
 */
function map(keys, mapFn, callback) {
  remote.checkGroup(this.gid);
  callback = callback === undefined ? () => {} : callback;
  if (!(keys instanceof Array)) {
    callback(new Error("Invalid keys"), null);
    return;
  }
  if (typeof mapFn !== "function") {
    callback(new Error("Invalid mapFn"), null);
    return;
  }

  const map = util.compile(
    (key, value) => {
      const fn = (0, eval)("__MAPFN__");
      const out = fn(key, value);
      return [out && typeof out === "object" ? out : {[key]: out}];
    },
    {"__MAPFN__": mapFn}
  );
  const reduce = (key, values) => ({[key]: values[0]});

  global.distribution[this.gid].mr.exec({
    keys,
    map,
    reduce,
    memory: true,
  }, callback);
}

/**
 * Apply a function; each input may yield zero or more outputs.
 * @param {string[]} keys
 * @param {function(key: any, value: any): object[]} flatMapFn - returns array of {[key]: value}
 * @param {Callback} callback
 */
function flatMap(keys, flatMapFn, callback) {
  remote.checkGroup(this.gid);
  callback = callback === undefined ? () => {} : callback;
  if (!(keys instanceof Array)) {
    callback(new Error("Invalid keys"), null);
    return;
  }
  if (typeof flatMapFn !== "function") {
    callback(new Error("Invalid flatMapFn"), null);
    return;
  }

  const map = util.compile(
    (key, value) => {
      const fn = (0, eval)("__FLATMAPFN__");
      const arr = fn(key, value);
      return Array.isArray(arr) ? arr : [];
    },
    {"__FLATMAPFN__": flatMapFn}
  );
  const reduce = (key, values) => ({[key]: values});

  global.distribution[this.gid].mr.exec({
    keys,
    map,
    reduce,
    memory: true,
  }, (error, results) => {
    if (error) {
      callback(error, null);
      return;
    }
    const flat = results.flatMap((r) =>
      Object.entries(r).flatMap(([k, vals]) =>
        [].concat(vals).map((v) => ({[k]: v}))
      )
    );
    callback(null, flat);
  });
}

/**
 * Keep only elements for which predicate(key, value) returns true.
 * @param {string[]} keys
 * @param {function(key: any, value: any): boolean} predicate
 * @param {Callback} callback
 */
function filter(keys, predicate, callback) {
  remote.checkGroup(this.gid);
  callback = callback === undefined ? () => {} : callback;
  if (!(keys instanceof Array)) {
    callback(new Error("Invalid keys"), null);
    return;
  }
  if (typeof predicate !== "function") {
    callback(new Error("Invalid predicate"), null);
    return;
  }

  const map = util.compile(
    (key, value) => {
      const fn = (0, eval)("__PREDICATE__");
      return fn(key, value) ? [{[key]: value}] : [];
    },
    {"__PREDICATE__": predicate}
  );
  const reduce = (key, values) => ({[key]: values[0]});

  global.distribution[this.gid].mr.exec({
    keys,
    map,
    reduce,
    memory: true,
  }, callback);
}

/**
 * Remove duplicate keys from the dataset.
 * @param {string[]} keys
 * @param {Callback} callback
 */
function distinct(keys, callback) {
  remote.checkGroup(this.gid);
  callback = callback === undefined ? () => {} : callback;
  if (!(keys instanceof Array)) {
    callback(new Error("Invalid keys"), null);
    return;
  }

  const map = (key) => [{[key]: key}];
  const reduce = (key, values) => ({[key]: values[0]});

  global.distribution[this.gid].mr.exec({
    keys,
    map,
    reduce,
    memory: true,
  }, callback);
}

/**
 * Return the total number of elements.
 * @param {string[]} keys
 * @param {Callback} callback
 */
function count(keys, callback) {
  remote.checkGroup(this.gid);
  callback = callback === undefined ? () => {} : callback;
  if (!(keys instanceof Array)) {
    callback(new Error("Invalid keys"), null);
    return;
  }

  const map = () => [{"__count__": 1}];
  const reduce = (key, values) => ({[key]: values.reduce((a, b) => a + b, 0)});

  global.distribution[this.gid].mr.exec({
    keys,
    map,
    reduce,
    compact: (key, values) => ({[key]: values.reduce((a, b) => a + b, 0)}),
    memory: true,
  }, (error, results) => {
    if (error) {
      callback(error, null);
      return;
    }
    const total = results
      .filter((r) => "__count__" in r)
      .reduce((sum, r) => sum + r["__count__"], 0);
    callback(null, total);
  });
}

/**
 * Return all elements to the caller (identity map-reduce).
 * @param {string[]} keys
 * @param {Callback} callback
 */
function collect(keys, callback) {
  remote.checkGroup(this.gid);
  callback = callback === undefined ? () => {} : callback;
  if (!(keys instanceof Array)) {
    callback(new Error("Invalid keys"), null);
    return;
  }

  const map = (key, value) => [{[key]: value}];
  const reduce = (key, values) => ({[key]: values[0]});

  global.distribution[this.gid].mr.exec({
    keys,
    map,
    reduce,
    memory: true,
  }, callback);
}

/**
 * Return the first element.
 * @param {string[]} keys
 * @param {Callback} callback
 */
function first(keys, callback) {
  collect.call(this, keys, (error, results) => {
    if (error) {
      callback(error, null);
      return;
    }
    callback(null, results.length > 0 ? results[0] : null);
  });
}

/**
 * Return the first n elements.
 * @param {string[]} keys
 * @param {number} n
 * @param {Callback} callback
 */
function take(keys, n, callback) {
  if (typeof callback !== "function") {
    callback = n;
    n = 1;
  }
  collect.call(this, keys, (error, results) => {
    if (error) {
      callback(error, null);
      return;
    }
    callback(null, results.slice(0, n));
  });
}

/**
 * Run a full map-reduce with user-provided map and reduce.
 * Wraps mr.exec for convenience.
 * @param {Object} config
 * @param {string[]} config.keys
 * @param {function} config.map
 * @param {function} config.reduce
 * @param {function} [config.compact]
 * @param {boolean} [config.memory]
 * @param {string} [config.out]
 * @param {Callback} callback
 */
function reduceByKey(config, callback) {
  remote.checkGroup(this.gid);
  callback = callback === undefined ? () => {} : callback;
  if (!config?.keys || !(config.keys instanceof Array)) {
    callback(new Error("Invalid keys"), null);
    return;
  }
  if (typeof config?.map !== "function" || typeof config?.reduce !== "function") {
    callback(new Error("Invalid map or reduce"), null);
    return;
  }

  const mrConfig = {
    keys: config.keys,
    map: config.map,
    reduce: config.reduce,
    compact: config.compact,
    memory: config.memory !== false,
    out: config.out,
  };
  global.distribution[this.gid].mr.exec(mrConfig, callback);
}

/**
 * Aggregate the entire dataset using a binary function.
 * @param {string[]} keys
 * @param {function(acc: any, item: object): any} reduceFn - (accumulator, {key: value}) => newAcc
 * @param {any} zeroValue - initial accumulator
 * @param {Callback} callback
 */
function reduce(keys, reduceFn, zeroValue, callback) {
  if (typeof callback !== "function") {
    callback = zeroValue;
    zeroValue = undefined;
  }
  remote.checkGroup(this.gid);
  callback = callback === undefined ? () => {} : callback;
  if (!(keys instanceof Array)) {
    callback(new Error("Invalid keys"), null);
    return;
  }
  if (typeof reduceFn !== "function") {
    callback(new Error("Invalid reduceFn"), null);
    return;
  }

  collect.call(this, keys, (error, results) => {
    if (error) {
      callback(error, null);
      return;
    }
    const acc = results.reduce(
      (a, item) => reduceFn(a, item),
      zeroValue
    );
    callback(null, acc);
  });
}

/**
 * Group all values per key.
 * @param {string[]} keys
 * @param {Callback} callback
 */
function groupByKey(keys, callback) {
  remote.checkGroup(this.gid);
  callback = callback === undefined ? () => {} : callback;
  if (!(keys instanceof Array)) {
    callback(new Error("Invalid keys"), null);
    return;
  }

  const map = (key, value) => [{[key]: value}];
  const reduce = (key, values) => ({[key]: values});

  global.distribution[this.gid].mr.exec({
    keys,
    map,
    reduce,
    memory: true,
  }, callback);
}

/**
 * Combine two datasets; duplicates may appear.
 * @param {string[]} keysA
 * @param {string[]} keysB
 * @param {Callback} callback
 */
function union(keysA, keysB, callback) {
  remote.checkGroup(this.gid);
  callback = callback === undefined ? () => {} : callback;
  if (!(keysA instanceof Array) || !(keysB instanceof Array)) {
    callback(new Error("Invalid keys"), null);
    return;
  }
  const keys = [...keysA, ...keysB];
  const map = (key, value) => [{[key]: value}];
  const reduce = (key, values) => ({[key]: values});
  global.distribution[this.gid].mr.exec({
    keys,
    map,
    reduce,
    memory: true,
  }, (error, results) => {
    if (error) {
      callback(error, null);
      return;
    }
    const flat = results.flatMap((r) =>
      Object.entries(r).flatMap(([k, vals]) =>
        [].concat(vals).map((v) => ({[k]: v}))
      )
    );
    callback(null, flat);
  });
}

/**
 * Elements (by key) present in both datasets.
 * @param {string[]} keysA
 * @param {string[]} keysB
 * @param {Callback} callback
 */
function intersection(keysA, keysB, callback) {
  remote.checkGroup(this.gid);
  callback = callback === undefined ? () => {} : callback;
  if (!(keysA instanceof Array) || !(keysB instanceof Array)) {
    callback(new Error("Invalid keys"), null);
    return;
  }
  const setB = new Set(keysB);
  const keys = keysA.filter((k) => setB.has(k));
  distinct.call(this, keys, callback);
}

/**
 * Elements in the first dataset but not the second (by key).
 * @param {string[]} keysA
 * @param {string[]} keysB
 * @param {Callback} callback
 */
function subtract(keysA, keysB, callback) {
  remote.checkGroup(this.gid);
  callback = callback === undefined ? () => {} : callback;
  if (!(keysA instanceof Array) || !(keysB instanceof Array)) {
    callback(new Error("Invalid keys"), null);
    return;
  }
  const setB = new Set(keysB);
  const keys = keysA.filter((k) => !setB.has(k));
  collect.call(this, keys, callback);
}

/**
 * Sort key-value pairs by key.
 * @param {string[]} keys
 * @param {{ascending?: boolean}} [opts] - default ascending: true
 * @param {Callback} callback
 */
function sortByKey(keys, opts, callback) {
  if (typeof opts === "function") {
    callback = opts;
    opts = {};
  } else {
    callback = callback === undefined ? () => {} : callback;
  }
  remote.checkGroup(this.gid);
  if (!(keys instanceof Array)) {
    callback(new Error("Invalid keys"), null);
    return;
  }
  const ascending = opts?.ascending !== false;
  collect.call(this, keys, (error, results) => {
    if (error) {
      callback(error, null);
      return;
    }
    results.sort((a, b) => {
      const ka = Object.keys(a)[0];
      const kb = Object.keys(b)[0];
      const cmp = ka < kb ? -1 : ka > kb ? 1 : 0;
      return ascending ? cmp : -cmp;
    });
    callback(null, results);
  });
}

/**
 * Inner join: for matching keys, produce (key, [value1, value2]).
 * @param {string[]} keysA
 * @param {string[]} keysB
 * @param {Callback} callback
 */
function join(keysA, keysB, callback) {
  remote.checkGroup(this.gid);
  callback = callback === undefined ? () => {} : callback;
  if (!(keysA instanceof Array) || !(keysB instanceof Array)) {
    callback(new Error("Invalid keys"), null);
    return;
  }
  collect.call(this, keysA, (errA, resultsA) => {
    if (errA) return callback(errA, null);
    collect.call(this, keysB, (errB, resultsB) => {
      if (errB) return callback(errB, null);
      const byKeyA = Object.fromEntries(
        resultsA.map((r) => {
          const k = Object.keys(r)[0];
          return [k, r[k]];
        })
      );
      const byKeyB = Object.fromEntries(
        resultsB.map((r) => {
          const k = Object.keys(r)[0];
          return [k, r[k]];
        })
      );
      const setB = new Set(keysB);
      const out = keysA
        .filter((k) => setB.has(k))
        .map((k) => ({[k]: [byKeyA[k], byKeyB[k]]}));
      callback(null, out);
    });
  });
}

/**
 * Left outer join: all keys from A; B values null when missing.
 * @param {string[]} keysA
 * @param {string[]} keysB
 * @param {Callback} callback
 */
function leftOuterJoin(keysA, keysB, callback) {
  remote.checkGroup(this.gid);
  callback = callback === undefined ? () => {} : callback;
  if (!(keysA instanceof Array) || !(keysB instanceof Array)) {
    callback(new Error("Invalid keys"), null);
    return;
  }
  collect.call(this, keysA, (errA, resultsA) => {
    if (errA) return callback(errA, null);
    collect.call(this, keysB, (errB, resultsB) => {
      if (errB) return callback(errB, null);
      const byKeyB = {};
      for (const r of resultsB) {
        const k = Object.keys(r)[0];
        byKeyB[k] = r[k];
      }
      const out = resultsA.map((r) => {
        const k = Object.keys(r)[0];
        const v2 = k in byKeyB ? byKeyB[k] : null;
        return {[k]: [r[k], v2]};
      });
      callback(null, out);
    });
  });
}

/**
 * Right outer join: all keys from B; A values null when missing.
 * @param {string[]} keysA
 * @param {string[]} keysB
 * @param {Callback} callback
 */
function rightOuterJoin(keysA, keysB, callback) {
  leftOuterJoin.call(this, keysB, keysA, (error, results) => {
    if (error) {
      callback(error, null);
      return;
    }
    const swapped = results.map((r) => {
      const k = Object.keys(r)[0];
      const [v1, v2] = r[k];
      return {[k]: [v2, v1]};
    });
    callback(null, swapped);
  });
}

/**
 * Apply a function to each element (for side effects).
 * @param {string[]} keys
 * @param {function(key: any, value: any): void} fn
 * @param {Callback} callback
 */
function foreach(keys, fn, callback) {
  remote.checkGroup(this.gid);
  callback = callback === undefined ? () => {} : callback;
  if (!(keys instanceof Array)) {
    callback(new Error("Invalid keys"), null);
    return;
  }
  if (typeof fn !== "function") {
    callback(new Error("Invalid fn"), null);
    return;
  }
  const map = util.compile(
    (key, value) => {
      const f = (0, eval)("__FOREACHFN__");
      f(key, value);
      return [{[key]: null}];
    },
    {"__FOREACHFN__": fn}
  );
  const reduce = (key, values) => ({[key]: values[0]});
  global.distribution[this.gid].mr.exec({
    keys,
    map,
    reduce,
    memory: true,
  }, (error) => callback(error, null));
}

module.exports = remote.createConstructor({
  map,
  flatMap,
  filter,
  distinct,
  count,
  collect,
  first,
  take,
  reduce,
  reduceByKey,
  groupByKey,
  union,
  intersection,
  subtract,
  sortByKey,
  join,
  leftOuterJoin,
  rightOuterJoin,
  foreach,
});
