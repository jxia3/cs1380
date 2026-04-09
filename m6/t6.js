/**
 * Manual test script for M6 Spark-inspired operations.
 *
 * Run with: ./scripts/run-test.sh m6/t6.js
 * (Kills ports first, runs with 45s timeout, cleans up after)
 *
 * Or: node m6/t6.js (ensure ports 1234, 2000-2002 are free first)
 */

const distribution = require("../distribution.js");

const basePort = 2000;
const nodes = [
  {ip: "127.0.0.1", port: basePort},
  {ip: "127.0.0.1", port: basePort + 1},
  {ip: "127.0.0.1", port: basePort + 2},
];

const dataset = [
  {"a": "apple"},
  {"b": "banana"},
  {"c": "cherry"},
  {"d": "date"},
  {"e": "elderberry"},
  {"a2": "apple"},
  {"b2": "banana"},
];

function getKeys() {
  return dataset.map((o) => Object.keys(o)[0]);
}

function runNext(tests, index, spark, keys, state, finish) {
  if (index >= tests.length) {
    finish();
    return;
  }
  const test = tests[index];
  test.run(spark, keys, (err, pass) => {
    state.passed += pass ? 1 : 0;
    console.log(pass ? "PASS" : "FAIL", test.name);
    if (err) {
      if (err && err.message) console.error(err.message);
      return finish();
    }
    runNext(tests, index + 1, spark, keys, state, finish);
  });
}

function runTests() {
  const groupConfig = {gid: "test", hash: distribution.util.id.consistentHash};
  const nodeList = [global.nodeConfig, ...nodes];

  distribution.local.groups.put(groupConfig, nodeList, (err) => {
    if (err) return console.error("local groups put:", err);
    distribution.test.groups.put(groupConfig, nodeList, (errors) => {
      if (errors && Object.keys(errors).length > 0) return console.error("test groups put:", errors);
      loadData(runSparkTests);
    });
  });
}

function loadData(done) {
  let cnt = 0;
  dataset.forEach((o) => {
    const key = Object.keys(o)[0];
    const value = o[key];
    distribution.test.store.put(value, key, () => {
      cnt++;
      if (cnt === dataset.length) done();
    });
  });
}

function runSparkTests() {
  const ourKeys = getKeys();
  distribution.test.store.get(null, (errors, keys) => {
    if (errors && Object.keys(errors).length > 0) return console.error("get keys:", errors);
    keys = keys.filter((k) => ourKeys.includes(k));
    if (keys.length === 0) return console.error("No keys found");

    console.log("Testing with", keys.length, "keys:", keys.sort().join(", "));
    console.log("---");

    const spark = distribution.test.spark;
    const keysA = ["a", "b", "c"];
    const keysB = ["b", "c", "d"];
    const state = {passed: 0};

    const tests = [
      {
        name: "count",
        run: (s, k, cb) => s.count(k, (err, n) => cb(err, !err && n === k.length)),
      },
      {
        name: "collect",
        run: (s, k, cb) => s.collect(k, (err, r) => cb(err, !err && r.length === k.length)),
      },
      {
        name: "map",
        run: (s, k, cb) => s.map(k, (key, v) => ({[key]: v.toUpperCase()}), (err, r) => {
          const apple = r && r.find((x) => "a" in x);
          cb(err, !err && apple && apple.a === "APPLE");
        }),
      },
      {
        name: "flatMap",
        run: (s, k, cb) => s.flatMap(k, (key, v) => v.split("").map((c) => ({[c]: 1})), (err, r) => {
          const aCount = r ? r.filter((x) => "a" in x).reduce((s, x) => s + (x.a || 0), 0) : 0;
          cb(err, !err && r && r.length > k.length && aCount >= 2);
        }),
      },
      {
        name: "filter",
        run: (s, k, cb) => s.filter(k, (key) => key.startsWith("a") || key.startsWith("b"), (err, r) => {
          const ok = r && r.every((x) => {
            const key = Object.keys(x)[0];
            return key.startsWith("a") || key.startsWith("b");
          });
          cb(err, !err && r && r.length === 4 && ok);
        }),
      },
      {
        name: "distinct",
        run: (s, k, cb) => s.distinct(k, (err, r) => cb(err, !err && r.length === k.length)),
      },
      {
        name: "first",
        run: (s, k, cb) => s.first(k, (err, r) => cb(err, !err && r && typeof r === "object")),
      },
      {
        name: "take(2)",
        run: (s, k, cb) => s.take(k, 2, (err, r) => cb(err, !err && r.length === 2)),
      },
      {
        name: "groupByKey",
        run: (s, k, cb) => s.groupByKey(k, (err, r) => {
          const apple = r && r.find((x) => "a" in x);
          cb(err, !err && r && r.length === k.length && apple && Array.isArray(apple.a));
        }),
      },
      {
        name: "reduceByKey",
        run: (s, k, cb) => s.reduceByKey({
          keys: k,
          map: (key, value) => [{[value]: 1}],
          reduce: (key, values) => ({[key]: values.reduce((a, b) => a + b, 0)}),
        }, (err, r) => {
          const apple = r && r.find((x) => "apple" in x);
          cb(err, !err && apple && apple.apple === 2);
        }),
      },
      {
        name: "reduce",
        run: (s, k, cb) => s.reduce(k, (acc, item) => {
          const v = Object.values(item)[0];
          return (acc || "") + (acc ? "," : "") + v;
        }, null, (err, r) => cb(err, !err && r && r.includes("apple"))),
      },
      {
        name: "union",
        run: (s, _, cb) => s.union(keysA, keysB, (err, r) => cb(err, !err && r.length === 6)),
      },
      {
        name: "intersection",
        run: (s, _, cb) => s.intersection(keysA, keysB, (err, r) => cb(err, !err && r.length === 2)),
      },
      {
        name: "subtract",
        run: (s, _, cb) => s.subtract(keysA, keysB, (err, r) => cb(err, !err && r.length === 1 && Object.keys(r[0])[0] === "a")),
      },
      {
        name: "sortByKey",
        run: (s, k, cb) => s.sortByKey(k, (err, r) => {
          const sorted = r && r.map((x) => Object.keys(x)[0]);
          cb(err, !err && sorted && sorted[0] <= sorted[sorted.length - 1]);
        }),
      },
      {
        name: "join",
        run: (s, _, cb) => s.join(keysA, keysB, (err, r) => cb(err, !err && r.length === 2)),
      },
      {
        name: "leftOuterJoin",
        run: (s, _, cb) => s.leftOuterJoin(keysA, keysB, (err, r) => {
          const hasNull = r && r.some((x) => Object.values(x)[0][1] === null);
          cb(err, !err && r && r.length === 3 && hasNull);
        }),
      },
      {
        name: "rightOuterJoin",
        run: (s, _, cb) => s.rightOuterJoin(keysA, keysB, (err, r) => {
          const hasNull = r && r.some((x) => Object.values(x)[0][0] === null);
          cb(err, !err && r && r.length === 3 && hasNull);
        }),
      },
      {
        name: "foreach",
        run: (s, k, cb) => s.foreach(k, () => {}, (err) => cb(err, !err)),
      },
      {
        name: "fluent map+filter+collect",
        run: (s, k, cb) => s.fromKeys(k)
          .map((key, v) => ({[key]: v.toUpperCase()}))
          .filter((key) => key.startsWith("a") || key.startsWith("b"))
          .collect((err, r) => {
            const ok = r && r.every((x) => {
              const key = Object.keys(x)[0];
              return (key.startsWith("a") || key.startsWith("b")) && x[key] === x[key].toUpperCase();
            });
            cb(err, !err && r && r.length === 4 && ok);
          }),
      },
      {
        name: "fluent count",
        run: (s, k, cb) => s.fromKeys(k).count((err, n) => cb(err, !err && n === k.length)),
      },
      {
        name: "fluent reduce",
        run: (s, k, cb) => s.fromKeys(k)
          .map((key, v) => ({[key]: v}))
          .reduce((acc, item) => {
            const v = Object.values(item)[0];
            return (acc || "") + (acc ? "," : "") + v;
          }, null, (err, r) => cb(err, !err && r && r.includes("apple"))),
      },
      {
        name: "distinct byPair",
        run: (s, k, cb) => s.distinct(k, {byPair: true}, (err, r) =>
          cb(err, !err && r && r.length === k.length)),
      },
      {
        name: "fluent flatMap+map+collect",
        run: (s, k, cb) => s.fromKeys(k)
          .flatMap((key, v) => v.split("").map((c) => ({[c]: 1})))
          .map((key, v) => ({[key]: v * 2}))
          .collect((err, r) => cb(err, !err && r && r.length > k.length)),
      },
    ];

    const finish = () => {
      console.log("---");
      console.log(state.passed + "/" + tests.length + " tests passed");
      process.exit(state.passed === tests.length ? 0 : 1);
    };

    runNext(tests, 0, spark, keys, state, finish);
  });
}

distribution.node.start(() => {
  distribution.local.status.spawn(nodes[0], () => {
    distribution.local.status.spawn(nodes[1], () => {
      distribution.local.status.spawn(nodes[2], () => runTests());
    });
  });
});
