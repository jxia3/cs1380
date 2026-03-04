/** @typedef {import("../types").Callback} Callback */

/* Spark-inspired operations that extend the MapReduce framework.
   Provides filter, distinct, count, collect, and other transformations.
   User functions are inlined via util.compile so they serialize correctly.
   Fluent RDD-like API: fromKeys(keys).map().filter().collect() with lazy eval and fusion. */

const remote = require("./remote-service.js");
const util = require("../util/util.js");

/**
 * RDD-like object for fluent chaining. Holds keys and a pipeline of ops.
 * Execution is lazy; actions (collect, count, reduce) trigger a fused MR job.
 */
function RDD(gid, keys, ops = []) {
  this._gid = gid;
  this._keys = keys;
  this._ops = ops;
}

RDD.prototype.map = function(mapFn) {
  if (typeof mapFn !== "function") throw new Error("Invalid mapFn");
  return new RDD(this._gid, this._keys, [...this._ops, {type: "map", fn: mapFn}]);
};

RDD.prototype.filter = function(predicate) {
  if (typeof predicate !== "function") throw new Error("Invalid predicate");
  return new RDD(this._gid, this._keys, [...this._ops, {type: "filter", fn: predicate}]);
};

RDD.prototype.flatMap = function(flatMapFn) {
  if (typeof flatMapFn !== "function") throw new Error("Invalid flatMapFn");
  return new RDD(this._gid, this._keys, [...this._ops, {type: "flatMap", fn: flatMapFn}]);
};

RDD.prototype._runFused = function(mode, callback) {
  const gid = this._gid;
  const keys = this._keys;
  const ops = this._ops;

  if (!(keys instanceof Array)) {
    callback(new Error("Invalid keys"), null);
    return;
  }

  const narrowOps = ["map", "filter"];
  const canFuse = ops.every((o) => narrowOps.includes(o.type));

  if (ops.some((o) => o.type === "flatMap")) {
    this._runWithFlatMap(mode, callback);
    return;
  }

  if (ops.length === 0) {
    if (mode === "count") {
      global.distribution[gid].spark.count(keys, callback);
    } else {
      global.distribution[gid].spark.collect(keys, callback);
    }
    return;
  }

  const compileValues = Object.fromEntries(ops.map((o, i) => [`__OP${i}__`, o.fn]));
  const bodyParts = ops.map((op, i) => {
    if (op.type === "map") {
      return `const fn${i}=(0,eval)("__OP${i}__");const out${i}=fn${i}(k,v);obj=out${i}&&typeof out${i}==="object"?out${i}:{[k]:out${i}};const ent${i}=Object.entries(obj);if(ent${i}.length===0)return [];[k,v]=ent${i}[0];`;
    } else {
      return `const fn${i}=(0,eval)("__OP${i}__");if(!fn${i}(k,v))return [];`;
    }
  }).join("");
  const returnExpr = mode === "count" ? '[{"__count__":1}]' : "[obj]";
  const fnStr = `(key,value)=>{let obj={[key]:value};let k=key,v=value;${bodyParts}return ${returnExpr};}`;
  const mapFn = util.compile(
    (new Function(`return ${fnStr}`))(),
    compileValues
  );

  const reduce = mode === "count"
    ? (key, values) => ({[key]: values.reduce((a, b) => a + b, 0)})
    : (key, values) => ({[key]: values[0]});

  const mrConfig = {
    keys,
    map: mapFn,
    reduce,
    memory: true,
  };
  if (mode === "count") {
    mrConfig.compact = (key, values) => ({[key]: values.reduce((a, b) => a + b, 0)});
  }

  global.distribution[gid].mr.exec(mrConfig, (error, results) => {
    if (error) {
      callback(error, null);
      return;
    }
    if (mode === "count") {
      const total = results
        .filter((r) => "__count__" in r)
        .reduce((sum, r) => sum + r["__count__"], 0);
      callback(null, total);
    } else {
      callback(null, results);
    }
  });
};

RDD.prototype._runWithFlatMap = function(mode, callback) {
  const gid = this._gid;
  const keys = this._keys;
  const ops = this._ops;
  const flatMapIdx = ops.findIndex((o) => o.type === "flatMap");
  const beforeFlatMap = ops.slice(0, flatMapIdx);
  const flatMapOp = ops[flatMapIdx];
  const afterFlatMap = ops.slice(flatMapIdx + 1);

  const runFirst = (cb) => {
    if (beforeFlatMap.length === 0) {
      global.distribution[gid].spark.collect(keys, cb);
      return;
    }
    const rdd = new RDD(gid, keys, beforeFlatMap);
    rdd._runFused(null, cb);
  };

  runFirst((err, results) => {
    if (err) return callback(err, null);
    const flatMapFn = flatMapOp.fn;
    let flat = results.flatMap((r) => {
      const k = Object.keys(r)[0];
      const v = r[k];
      const arr = flatMapFn(k, v);
      return Array.isArray(arr) ? arr : [];
    });
    for (const op of afterFlatMap) {
      if (op.type === "map") {
        flat = flat.map((item) => {
          const ent = Object.entries(item)[0];
          if (!ent) return item;
          const [k, v] = ent;
          const out = op.fn(k, v);
          return out && typeof out === "object" ? out : {[k]: out};
        });
      } else if (op.type === "filter") {
        flat = flat.filter((item) => {
          const ent = Object.entries(item)[0];
          if (!ent) return false;
          return op.fn(ent[0], ent[1]);
        });
      } else if (op.type === "flatMap") {
        flat = flat.flatMap((item) => {
          const ent = Object.entries(item)[0];
          if (!ent) return [];
          const arr = op.fn(ent[0], ent[1]);
          return Array.isArray(arr) ? arr : [];
        });
      }
    }
    if (mode === "count") {
      callback(null, flat.length);
    } else {
      callback(null, flat);
    }
  });
};

RDD.prototype.collect = function(callback) {
  callback = callback || (() => {});
  this._runFused(null, callback);
};

RDD.prototype.count = function(callback) {
  callback = callback || (() => {});
  this._runFused("count", callback);
};

RDD.prototype.reduce = function(reduceFn, zeroValue, callback) {
  if (typeof callback !== "function") {
    callback = zeroValue;
    zeroValue = undefined;
  }
  callback = callback || (() => {});
  this.collect((err, results) => {
    if (err) return callback(err, null);
    const acc = results.reduce((a, item) => reduceFn(a, item), zeroValue);
    callback(null, acc);
  });
};

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
 * Remove duplicates. By default deduplicates by key; use opts.byPair for (key, value).
 * @param {string[]} keys
 * @param {{byPair?: boolean} | Callback} [opts]
 * @param {Callback} [callback]
 */
function distinct(keys, opts, callback) {
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

  if (opts?.byPair) {
    const map = (key, value) => {
      const s = JSON.stringify([key, value]);
      let h = 0;
      for (let i = 0; i < s.length; i++) h = ((h << 5) - h) + s.charCodeAt(i) | 0;
      const hash = Math.abs(h).toString(36);
      return [{[`__pair_${hash}`]: {key, value}}];
    };
    const reduce = (partKey, values) => {
      const item = values[0];
      return item && item.key !== undefined ? {[partKey]: item} : {};
    };
    global.distribution[this.gid].mr.exec({
      keys,
      map,
      reduce,
      memory: true,
    }, (error, results) => {
      if (error) return callback(error, null);
      const out = results
        .filter((r) => r && Object.keys(r).some((k) => k.startsWith("__pair_")))
        .flatMap((r) => {
          for (const k of Object.keys(r)) {
            if (k.startsWith("__pair_") && r[k]?.key !== undefined) {
              return [{[r[k].key]: r[k].value}];
            }
          }
          return [];
        });
      callback(null, out);
    });
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
 * User functions are inlined via util.compile so they serialize correctly.
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

  const map = util.compile(
    (key, value) => {
      const fn = (0, eval)("__MAPFN__");
      return fn(key, value);
    },
    {"__MAPFN__": config.map}
  );
  const reduce = util.compile(
    (key, values) => {
      const fn = (0, eval)("__REDUCEFN__");
      return fn(key, values);
    },
    {"__REDUCEFN__": config.reduce}
  );

  const mrConfig = {
    keys: config.keys,
    map,
    reduce,
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
 * Sort key-value pairs by key. Uses distributed range partitioning when
 * keys.length exceeds distributedSortThreshold (default 8).
 * @param {string[]} keys
 * @param {{ascending?: boolean, distributedSortThreshold?: number}} [opts]
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
  const threshold = opts?.distributedSortThreshold ?? 8;

  if (keys.length < threshold) {
    collect.call(this, keys, (error, results) => {
      if (error) return callback(error, null);
      results.sort((a, b) => {
        const ka = Object.keys(a)[0];
        const kb = Object.keys(b)[0];
        const cmp = ka < kb ? -1 : ka > kb ? 1 : 0;
        return ascending ? cmp : -cmp;
      });
      callback(null, results);
    });
    return;
  }

  const sortedKeys = [...keys].sort();
  const numPartitions = Math.min(keys.length, 16);
  const boundaries = [];
  for (let i = 1; i < numPartitions; i++) {
    boundaries.push(sortedKeys[Math.floor((sortedKeys.length * i) / numPartitions)]);
  }

  const map = util.compile(
    (key, value) => {
      const b = __BOUNDARIES__;
      let pid = b.findIndex((x) => key < x);
      if (pid < 0) pid = b.length;
      return [{[`__sort_${pid}`]: {key, value}}];
    },
    {"__BOUNDARIES__": boundaries}
  );
  const reduce = (partKey, values) => {
    const items = values.map((v) => (v && typeof v === "object" && "key" in v) ? v : {key: partKey, value: v});
    items.sort((a, b) => {
      const cmp = a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
      return ascending ? cmp : -cmp;
    });
    const pid = partKey.replace("__sort_", "");
    return {[`__sort_${pid}`]: items};
  };

  global.distribution[this.gid].mr.exec({
    keys,
    map,
    reduce,
    memory: true,
  }, (error, results) => {
    if (error) return callback(error, null);
    const byPart = {};
    for (const r of results) {
      for (const k in r) {
        if (k.startsWith("__sort_")) byPart[k] = r[k];
      }
    }
    const partIds = Object.keys(byPart).sort((a, b) =>
      parseInt(a.replace("__sort_", ""), 10) - parseInt(b.replace("__sort_", ""), 10));
    const flat = partIds.flatMap((p) => byPart[p] || []);
    const out = flat.map((item) => ({[item.key]: item.value}));
    callback(null, out);
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

/**
 * Create an RDD from keys for fluent chaining.
 * @param {string[]} keys
 * @returns {RDD}
 */
function fromKeys(keys) {
  remote.checkGroup(this.gid);
  if (!(keys instanceof Array)) {
    throw new Error("Invalid keys");
  }
  return new RDD(this.gid, keys, []);
}

module.exports = remote.createConstructor({
  fromKeys,
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
