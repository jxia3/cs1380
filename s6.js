/**
 * Spark Fluent API Showcase
 *
 * Demonstrates the chainable RDD-style API: fromKeys(keys).map().filter().collect()
 *
 * Run with: ./scripts/run-test.sh s6.js
 * Or: node s6.js (ensure ports 1234, 2000-2002 are free)
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
  {"a2": "apple"},
  {"b2": "banana"},
];

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

function runShowcase() {
  const spark = distribution.test.spark;
  distribution.test.store.get(null, (errors, keys) => {
    if (errors && Object.keys(errors).length > 0) {
      console.error("get keys:", errors);
      process.exit(1);
    }
    keys = keys.filter((k) => dataset.some((o) => Object.keys(o)[0] === k));
    if (keys.length === 0) {
      console.error("No keys found");
      process.exit(1);
    }

    console.log("Spark Fluent API Showcase");
    console.log("Keys:", keys.sort().join(", "));
    console.log("");

    // --- Example 1: map + filter + collect ---
    console.log("1. map + filter + collect");
    console.log("   Uppercase values, keep only keys starting with 'a' or 'b'");
    spark.fromKeys(keys)
      .map((key, v) => ({[key]: v.toUpperCase()}))
      .filter((key) => key.startsWith("a") || key.startsWith("b"))
      .collect((err, results) => {
        if (err) return console.error(err);
        console.log("   Result:", results);
        console.log("");

        // --- Example 2: map + count ---
        console.log("2. map + count");
        console.log("   Count all items (after mapping to uppercase)");
        spark.fromKeys(keys)
          .map((key, v) => ({[key]: v.toUpperCase()}))
          .count((err, n) => {
            if (err) return console.error(err);
            console.log("   Result:", n);
            console.log("");

            // --- Example 3: map + reduce ---
            console.log("3. map + reduce");
            console.log("   Concatenate all values into a single string");
            spark.fromKeys(keys)
              .map((key, v) => ({[key]: v}))
              .reduce((acc, item) => {
                const v = Object.values(item)[0];
                return (acc || "") + (acc ? "," : "") + v;
              }, null, (err, result) => {
                if (err) return console.error(err);
                console.log("   Result:", result);
                console.log("");

                // --- Example 4: flatMap + map + collect ---
                console.log("4. flatMap + map + collect");
                console.log("   Split each value into chars, double the counts");
                spark.fromKeys(keys)
                  .flatMap((key, v) => v.split("").map((c) => ({[c]: 1})))
                  .map((key, v) => ({[key]: v * 2}))
                  .collect((err, results) => {
                    if (err) return console.error(err);
                    const sample = results.slice(0, 5);
                    console.log("   Result (first 5):", sample, "...");
                    console.log("");
                    console.log("Done.");
                    process.exit(0);
                  });
              });
          });
      });
  });
}

distribution.node.start(() => {
  distribution.local.status.spawn(nodes[0], () => {
    distribution.local.status.spawn(nodes[1], () => {
      distribution.local.status.spawn(nodes[2], () => {
        const groupConfig = {gid: "test", hash: distribution.util.id.consistentHash};
        const nodeList = [global.nodeConfig, ...nodes];
        distribution.local.groups.put(groupConfig, nodeList, (err) => {
          if (err) return console.error("local groups put:", err);
          distribution.test.groups.put(groupConfig, nodeList, (errors) => {
            if (errors && Object.keys(errors).length > 0) return console.error("test groups put:", errors);
            loadData(runShowcase);
          });
        });
      });
    });
  });
});
