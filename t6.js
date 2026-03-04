/**
 * Manual test script for M6 Spark-inspired operations.
 *
 * Run with: ./scripts/run-test.sh t6.js
 * (Kills ports first, runs with 45s timeout, cleans up after)
 *
 * Or: node t6.js (ensure ports 1234, 2000-2002 are free first)
 */

const distribution = require("./distribution.js");

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
  {"a2": "apple"},  // duplicate value
  {"b2": "banana"},
];

distribution.node.start(() => {
  distribution.local.status.spawn(nodes[0], () => {
    distribution.local.status.spawn(nodes[1], () => {
      distribution.local.status.spawn(nodes[2], () => {
        runTests();
      });
    });
  });
});

function runTests() {
  const groupConfig = {gid: "test", hash: distribution.util.id.consistentHash};
  distribution.local.groups.put(groupConfig, [global.nodeConfig, ...nodes], (err) => {
    if (err) return console.error("local groups put:", err);
    distribution.test.groups.put(groupConfig, [global.nodeConfig, ...nodes], (errors) => {
      if (errors && Object.keys(errors).length > 0) return console.error("test groups put:", errors);
      loadData(() => {
        runSparkTests();
      });
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
  const ourKeys = dataset.map((o) => Object.keys(o)[0]);
  distribution.test.store.get(null, (errors, keys) => {
    if (errors && Object.keys(errors).length > 0) return console.error("get keys:", errors);
    keys = keys.filter((k) => ourKeys.includes(k));
    if (keys.length === 0) return console.error("No keys found");
    console.log("Testing with", keys.length, "keys:", keys.sort().join(", "));
    console.log("---");

    const state = { passed: 0 };
    const ok = (name, cond) => {
      if (cond) {
        console.log("PASS", name);
        state.passed++;
      } else {
        console.log("FAIL", name);
      }
    };
    const totalTests = 19;
    const finish = () => {
      console.log("---");
      console.log(state.passed + "/" + totalTests + " tests passed");
      process.exit(state.passed === totalTests ? 0 : 1);
    };

    // Test 1: count
    distribution.test.spark.count(keys, (err, n) => {
      ok("count", !err && n === keys.length);
      if (err) return finish();

      // Test 2: collect
      distribution.test.spark.collect(keys, (err, results) => {
        ok("collect", !err && results.length === keys.length);
        if (err) return finish();

        // Test 3: map (uppercase values)
        distribution.test.spark.map(keys, (k, v) => ({[k]: v.toUpperCase()}), (err, mapped) => {
          const apple = mapped && mapped.find((r) => "a" in r);
          const pass = !err && apple && apple.a === "APPLE";
          if (!pass) console.log("map debug:", {err, mapped: mapped?.slice(0, 2), apple});
          ok("map", pass);
          if (err) return finish();

          // Test 4: flatMap (split value into chars)
          distribution.test.spark.flatMap(keys, (k, v) => v.split("").map((c) => ({[c]: 1})), (err, flat) => {
            const aCount = flat.filter((r) => "a" in r).reduce((s, r) => s + (r.a || 0), 0);
            ok("flatMap", !err && flat.length > keys.length && aCount >= 2);
            if (err) return finish();

            // Test 5: filter
            distribution.test.spark.filter(keys, (k) => k.startsWith("a") || k.startsWith("b"), (err, filtered) => {
              ok("filter", !err && filtered.length === 4 && filtered.every((r) => {
                const k = Object.keys(r)[0];
                return k.startsWith("a") || k.startsWith("b");
              }));
              if (err) return finish();

              // Test 6: distinct (by key)
              distribution.test.spark.distinct(keys, (err, distinctResults) => {
                ok("distinct", !err && distinctResults.length === keys.length);
                if (err) return finish();

                // Test 7: first
                distribution.test.spark.first(keys, (err, firstItem) => {
                  ok("first", !err && firstItem && typeof firstItem === "object");
                  if (err) return finish();

                  // Test 8: take(2)
                  distribution.test.spark.take(keys, 2, (err, taken) => {
                    ok("take(2)", !err && taken.length === 2);
                    if (err) return finish();

                    // Test 9: groupByKey
                    distribution.test.spark.groupByKey(keys, (err, grouped) => {
                      const appleGroup = grouped.find((r) => "a" in r);
                      ok("groupByKey", !err && grouped.length === keys.length && appleGroup && Array.isArray(appleGroup.a));
                      if (err) return finish();

                      // Test 10: reduceByKey (word count by value)
                      const mapFn = (key, value) => [{[value]: 1}];
                      const reduceFn = (key, values) => ({[key]: values.reduce((a, b) => a + b, 0)});
                      distribution.test.spark.reduceByKey({keys, map: mapFn, reduce: reduceFn}, (err, reduced) => {
                        const appleCount = reduced.find((r) => "apple" in r);
                        ok("reduceByKey", !err && appleCount && appleCount.apple === 2);
                        if (err) return finish();

                        // Test 11: reduce (concat all values)
                        distribution.test.spark.reduce(keys, (acc, item) => {
                          const v = Object.values(item)[0];
                          return (acc || "") + (acc ? "," : "") + v;
                        }, null, (err, reducedAll) => {
                          ok("reduce", !err && reducedAll && reducedAll.includes("apple"));
                          if (err) return finish();

                          const keysA = ["a", "b", "c"];
                          const keysB = ["b", "c", "d"];

                          // Test 12: union
                          distribution.test.spark.union(keysA, keysB, (err, u) => {
                            ok("union", !err && u.length === 6);
                            if (err) return finish();

                            // Test 13: intersection
                            distribution.test.spark.intersection(keysA, keysB, (err, i) => {
                              ok("intersection", !err && i.length === 2);
                              if (err) return finish();

                              // Test 14: subtract
                              distribution.test.spark.subtract(keysA, keysB, (err, s) => {
                                ok("subtract", !err && s.length === 1 && Object.keys(s[0])[0] === "a");
                                if (err) return finish();

                                // Test 15: sortByKey
                                distribution.test.spark.sortByKey(keys, (err, sorted) => {
                                  const sortedKeys = sorted && sorted.map((r) => Object.keys(r)[0]);
                                  ok("sortByKey", !err && sortedKeys && sortedKeys[0] <= sortedKeys[sortedKeys.length - 1]);
                                  if (err) return finish();

                                  // Test 16: join
                                  distribution.test.spark.join(keysA, keysB, (err, j) => {
                                    ok("join", !err && j.length === 2);
                                    if (err) return finish();

                                    // Test 17: leftOuterJoin
                                    distribution.test.spark.leftOuterJoin(keysA, keysB, (err, loj) => {
                                      const hasNull = loj && loj.some((r) => {
                                        const [v1, v2] = Object.values(r)[0];
                                        return v2 === null;
                                      });
                                      ok("leftOuterJoin", !err && loj.length === 3 && hasNull);
                                      if (err) return finish();

                                      // Test 18: rightOuterJoin
                                      distribution.test.spark.rightOuterJoin(keysA, keysB, (err, roj) => {
                                        const hasNull = roj && roj.some((r) => {
                                          const [v1, v2] = Object.values(r)[0];
                                          return v1 === null;
                                        });
                                        ok("rightOuterJoin", !err && roj.length === 3 && hasNull);
                                        if (err) return finish();

                                        // Test 19: foreach (side-effect runs on workers; we verify no error)
                                        distribution.test.spark.foreach(keys, () => {}, (err) => {
                                          ok("foreach", !err);
                                          finish();
                                        });
                                      });
                                    });
                                  });
                                });
                              });
                            });
                          });
                        });
                      });
                    });
                  });
                });
              });
            });
          });
        });
      });
    });
  });
}
