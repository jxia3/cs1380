/*
  In this file, add your own test cases that correspond to functionality introduced for M6.
  You should fill out each test case so it adequately tests the functionality you implemented.
  You are left to decide what the complexity of each test case should be, but trivial test cases
  that abuse this flexibility might be subject to deductions.

  Important: Do not modify any of the test headers (i.e., the test('header', ...) part).
  Doing so will result in grading penalties.
*/

jest.setTimeout(60000);

const distribution = require("../../config.js");
const fs = require("fs");
const path = require("path");
const util = distribution.util;

let localServer = null;
const nodes = [
  {ip: "127.0.0.1", port: 7200},
  {ip: "127.0.0.1", port: 7201},
  {ip: "127.0.0.1", port: 7202},
  {ip: "127.0.0.1", port: 7203},
];
const nodeMap = {};
nodeMap[util.id.getSID(global.nodeConfig)] = global.nodeConfig;
for (const node of nodes) {
  nodeMap[util.id.getSID(node)] = node;
}

const dataset = [
  {"a": "apple"},
  {"b": "banana"},
  {"c": "cherry"},
  {"d": "date"},
  {"e": "elderberry"},
  {"a2": "apple"},
  {"b2": "banana"},
];

function createDataset(callback) {
  let active = dataset.length;
  for (const item of dataset) {
    const key = Object.keys(item)[0];
    distribution.m6.store.put(item[key], key, (error) => {
      active -= 1;
      if (active === 0) callback();
    });
  }
}

function getKeys() {
  return dataset.map((o) => Object.keys(o)[0]);
}

test("(1 pts) student test", (done) => {
  distribution.empty.spark.count([], (error, n) => {
    try {
      expect(error).toBeFalsy();
      expect(n).toBe(0);
      done();
    } catch (e) {
      done(e);
    }
  });
});

test("(1 pts) student test", (done) => {
  createDataset(() => {
    const keys = getKeys();
    distribution.m6.spark.count(keys, (error, n) => {
      try {
        expect(error).toBeFalsy();
        expect(n).toBe(keys.length);
        done();
      } catch (e) {
        done(e);
      }
    });
  });
});

test("(1 pts) student test", (done) => {
  createDataset(() => {
    const keys = getKeys();
    distribution.m6.spark.collect(keys, (error, results) => {
      try {
        expect(error).toBeFalsy();
        expect(results).toBeInstanceOf(Array);
        expect(results.length).toBe(keys.length);
        const apple = results.find((r) => "a" in r);
        expect(apple).toBeDefined();
        expect(apple.a).toBe("apple");
        done();
      } catch (e) {
        done(e);
      }
    });
  });
});

test("(1 pts) student test", (done) => {
  createDataset(() => {
    const keys = getKeys();
    distribution.m6.spark.map(keys, (k, v) => ({[k]: v.toUpperCase()}), (error, mapped) => {
      try {
        expect(error).toBeFalsy();
        const apple = mapped.find((r) => "a" in r);
        expect(apple).toBeDefined();
        expect(apple.a).toBe("APPLE");
        done();
      } catch (e) {
        done(e);
      }
    });
  });
});

test("(1 pts) student test", (done) => {
  createDataset(() => {
    const keys = getKeys();
    distribution.m6.spark.flatMap(keys, (k, v) =>
      v.split("").map((c) => ({[c]: 1})), (error, flat) => {
      try {
        expect(error).toBeFalsy();
        expect(flat.length).toBeGreaterThan(keys.length);
        const aCount = flat.filter((r) => "a" in r).reduce((s, r) => s + (r.a || 0), 0);
        expect(aCount).toBeGreaterThanOrEqual(2);
        done();
      } catch (e) {
        done(e);
      }
    });
  });
});

test("(1 pts) student test", (done) => {
  createDataset(() => {
    const keys = getKeys();
    distribution.m6.spark.filter(keys, (k) => k.startsWith("a") || k.startsWith("b"),
      (error, filtered) => {
        try {
          expect(error).toBeFalsy();
          expect(filtered.length).toBe(4);
          expect(filtered.every((r) => {
            const k = Object.keys(r)[0];
            return k.startsWith("a") || k.startsWith("b");
          })).toBe(true);
          done();
        } catch (e) {
          done(e);
        }
      });
  });
});

test("(1 pts) student test", (done) => {
  createDataset(() => {
    const keys = getKeys();
    distribution.m6.spark.distinct(keys, (error, distinctResults) => {
      try {
        expect(error).toBeFalsy();
        expect(distinctResults.length).toBe(keys.length);
        done();
      } catch (e) {
        done(e);
      }
    });
  });
});

test("(1 pts) student test", (done) => {
  createDataset(() => {
    const keys = getKeys();
    distribution.m6.spark.first(keys, (error, firstItem) => {
      try {
        expect(error).toBeFalsy();
        expect(firstItem).toBeDefined();
        expect(typeof firstItem).toBe("object");
        done();
      } catch (e) {
        done(e);
      }
    });
  });
});

test("(1 pts) student test", (done) => {
  createDataset(() => {
    const keys = getKeys();
    distribution.m6.spark.take(keys, 2, (error, taken) => {
      try {
        expect(error).toBeFalsy();
        expect(taken.length).toBe(2);
        done();
      } catch (e) {
        done(e);
      }
    });
  });
});

test("(1 pts) student test", (done) => {
  createDataset(() => {
    const keys = getKeys();
    distribution.m6.spark.groupByKey(keys, (error, grouped) => {
      try {
        expect(error).toBeFalsy();
        expect(grouped.length).toBe(keys.length);
        const appleGroup = grouped.find((r) => "a" in r);
        expect(appleGroup).toBeDefined();
        expect(Array.isArray(appleGroup.a)).toBe(true);
        done();
      } catch (e) {
        done(e);
      }
    });
  });
});

test("(1 pts) student test", (done) => {
  createDataset(() => {
    const keys = getKeys();
    const mapFn = (key, value) => [{[value]: 1}];
    const reduceFn = (key, values) => ({[key]: values.reduce((a, b) => a + b, 0)});
    distribution.m6.spark.reduceByKey({keys, map: mapFn, reduce: reduceFn}, (error, reduced) => {
      try {
        expect(error).toBeFalsy();
        const appleCount = reduced.find((r) => "apple" in r);
        expect(appleCount).toBeDefined();
        expect(appleCount.apple).toBe(2);
        done();
      } catch (e) {
        done(e);
      }
    });
  });
});

test("(1 pts) student test", (done) => {
  createDataset(() => {
    const keys = getKeys();
    distribution.m6.spark.reduce(keys, (acc, item) => {
      const v = Object.values(item)[0];
      return (acc || "") + (acc ? "," : "") + v;
    }, null, (error, reducedAll) => {
      try {
        expect(error).toBeFalsy();
        expect(reducedAll).toBeDefined();
        expect(reducedAll.includes("apple")).toBe(true);
        done();
      } catch (e) {
        done(e);
      }
    });
  });
});

test("(1 pts) student test", (done) => {
  createDataset(() => {
    const keysA = ["a", "b", "c"];
    const keysB = ["b", "c", "d"];
    distribution.m6.spark.union(keysA, keysB, (error, u) => {
      try {
        expect(error).toBeFalsy();
        expect(u.length).toBe(6);
        done();
      } catch (e) {
        done(e);
      }
    });
  });
});

test("(1 pts) student test", (done) => {
  createDataset(() => {
    const keysA = ["a", "b", "c"];
    const keysB = ["b", "c", "d"];
    distribution.m6.spark.intersection(keysA, keysB, (error, i) => {
      try {
        expect(error).toBeFalsy();
        expect(i.length).toBe(2);
        done();
      } catch (e) {
        done(e);
      }
    });
  });
});

test("(1 pts) student test", (done) => {
  createDataset(() => {
    const keysA = ["a", "b", "c"];
    const keysB = ["b", "c", "d"];
    distribution.m6.spark.subtract(keysA, keysB, (error, s) => {
      try {
        expect(error).toBeFalsy();
        expect(s.length).toBe(1);
        expect(Object.keys(s[0])[0]).toBe("a");
        done();
      } catch (e) {
        done(e);
      }
    });
  });
});

test("(1 pts) student test", (done) => {
  createDataset(() => {
    const keys = getKeys();
    distribution.m6.spark.sortByKey(keys, (error, sorted) => {
      try {
        expect(error).toBeFalsy();
        const sortedKeys = sorted.map((r) => Object.keys(r)[0]);
        expect(sortedKeys[0] <= sortedKeys[sortedKeys.length - 1]).toBe(true);
        done();
      } catch (e) {
        done(e);
      }
    });
  });
});

test("(1 pts) student test", (done) => {
  createDataset(() => {
    const keysA = ["a", "b", "c"];
    const keysB = ["b", "c", "d"];
    distribution.m6.spark.join(keysA, keysB, (error, j) => {
      try {
        expect(error).toBeFalsy();
        expect(j.length).toBe(2);
        done();
      } catch (e) {
        done(e);
      }
    });
  });
});

test("(1 pts) student test", (done) => {
  createDataset(() => {
    const keysA = ["a", "b", "c"];
    const keysB = ["b", "c", "d"];
    distribution.m6.spark.leftOuterJoin(keysA, keysB, (error, loj) => {
      try {
        expect(error).toBeFalsy();
        expect(loj.length).toBe(3);
        const hasNull = loj.some((r) => {
          const [v1, v2] = Object.values(r)[0];
          return v2 === null;
        });
        expect(hasNull).toBe(true);
        done();
      } catch (e) {
        done(e);
      }
    });
  });
});

test("(1 pts) student test", (done) => {
  createDataset(() => {
    const keysA = ["a", "b", "c"];
    const keysB = ["b", "c", "d"];
    distribution.m6.spark.rightOuterJoin(keysA, keysB, (error, roj) => {
      try {
        expect(error).toBeFalsy();
        expect(roj.length).toBe(3);
        const hasNull = roj.some((r) => {
          const [v1, v2] = Object.values(r)[0];
          return v1 === null;
        });
        expect(hasNull).toBe(true);
        done();
      } catch (e) {
        done(e);
      }
    });
  });
});

test("(1 pts) student test", (done) => {
  createDataset(() => {
    const keys = getKeys();
    distribution.m6.spark.foreach(keys, () => {}, (error) => {
      try {
        expect(error).toBeFalsy();
        done();
      } catch (e) {
        done(e);
      }
    });
  });
});

test("(1 pts) student test", (done) => {
  createDataset(() => {
    const keys = getKeys();
    distribution.m6.spark.fromKeys(keys)
      .map((k, v) => ({[k]: v.toUpperCase()}))
      .filter((k) => k.startsWith("a") || k.startsWith("b"))
      .collect((error, results) => {
        try {
          expect(error).toBeFalsy();
          expect(results.length).toBe(4);
          expect(results.every((r) => {
            const k = Object.keys(r)[0];
            return (k.startsWith("a") || k.startsWith("b")) && r[k] === r[k].toUpperCase();
          })).toBe(true);
          done();
        } catch (e) {
          done(e);
        }
      });
  });
});

test("(1 pts) student test", (done) => {
  createDataset(() => {
    const keys = getKeys();
    distribution.m6.spark.fromKeys(keys).count((error, n) => {
      try {
        expect(error).toBeFalsy();
        expect(n).toBe(keys.length);
        done();
      } catch (e) {
        done(e);
      }
    });
  });
});

test("(1 pts) student test", (done) => {
  createDataset(() => {
    const keys = getKeys();
    distribution.m6.spark.fromKeys(keys)
      .map((k, v) => ({[k]: v}))
      .reduce((acc, item) => {
        const v = Object.values(item)[0];
        return (acc || "") + (acc ? "," : "") + v;
      }, null, (error, reduced) => {
        try {
          expect(error).toBeFalsy();
          expect(reduced).toBeDefined();
          expect(reduced.includes("apple")).toBe(true);
          done();
        } catch (e) {
          done(e);
        }
      });
  });
});

beforeAll((done) => {
  fs.rmSync(path.join(__dirname, "../../store"), {recursive: true, force: true});
  fs.mkdirSync(path.join(__dirname, "../../store"));

  const groups = [
    {name: "empty", hash: util.id.consistentHash, nodes: nodeMap},
    {name: "m6", hash: util.id.consistentHash, nodes: nodeMap},
  ];
  let index = 0;

  stopNodes(() => {
    function addGroup() {
      if (index >= groups.length) {
        done();
        return;
      }
      const config = {gid: groups[index].name, hash: groups[index].hash};
      distribution.local.groups.put(config, groups[index].nodes, (e, v) => {
        distribution[groups[index].name].groups.put(config, groups[index].nodes, (e, v) => {
          index += 1;
          addGroup();
        });
      });
    }

    distribution.node.start((server) => {
      localServer = server;
      distribution.local.status.spawn(nodes[0], (error, result) => {
        distribution.local.status.spawn(nodes[1], (error, result) => {
          distribution.local.status.spawn(nodes[2], (error, result) => {
            distribution.local.status.spawn(nodes[3], (error, result) => {
              addGroup();
            });
          });
        });
      });
    });
  });
});

afterAll((done) => {
  stopNodes(() => {
    localServer.close();
    done();
  });
});

function stopNodes(callback) {
  const stopMethod = {service: "status", method: "stop"};
  stopMethod.node = nodes[0];
  distribution.local.comm.send([], stopMethod, (error, result) => {
    stopMethod.node = nodes[1];
    distribution.local.comm.send([], stopMethod, (error, result) => {
      stopMethod.node = nodes[2];
      distribution.local.comm.send([], stopMethod, (error, result) => {
        stopMethod.node = nodes[3];
        distribution.local.comm.send([], stopMethod, (error, result) => {
          callback();
        });
      });
    });
  });
}
