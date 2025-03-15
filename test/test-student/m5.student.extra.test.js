/*
  In this file, add your own test case that will confirm your correct implementation of the extra-credit functionality.
  You are left to decide what the complexity of each test case should be, but trivial test cases that abuse this flexibility might be subject to deductions.

  Imporant: Do not modify any of the test headers (i.e., the test('header', ...) part). Doing so will result in grading penalties.
*/

const distribution = require("../../config.js");

const fs = require("fs");
const path = require("path");

const util = distribution.util;

let localServer = null;
const nodes = [
  {ip: "127.0.0.1", port: 2000},
  {ip: "127.0.0.1", port: 2001},
  {ip: "127.0.0.1", port: 2002},
  {ip: "127.0.0.1", port: 2003},
];
const nodeMap = {};
nodeMap[util.id.getSID(global.nodeConfig)] = global.nodeConfig;
for (const node of nodes) {
  nodeMap[util.id.getSID(node)] = node;
}

const dataset = [
  {"0": "a b c"},
  {"1": "d e f g h i"},
  {"2": "j k l m n o p q r"},
];

function createDataset(group, callback) {
  let active = dataset.length;
  for (const item of dataset) {
    const key = Object.keys(item)[0];
    distribution[group].store.put(item[key], key, (error, result) => {
      active -= 1;
      if (active === 0) {
        callback();
      }
    });
  }
}

function combineMap(key, value) {
  const results = [];
  const words = value.split(" ");
  for (let w = 0; w < words.length - 1; w += 2) {
    results.push({[key]: `${words[w]}${words[w + 1]}`});
  }
  if (words.length % 2 === 1) {
    results.push({[key]: words[words.length - 1]});
  }
  return results;
}

function combineReduce(key, values) {
  values.sort();
  return {[key]: values.join(" ")};
}

const wordCountConfig = {
  keys: dataset.flatMap((i) => Object.keys(i)),
  map: combineMap,
  reduce: combineReduce,
};

const expectedResults = [
  [
    {"0": "ab c"},
    {"1": "de fg hi"},
    {"2": "jk lm no pq r"},
  ],
  [
    {"0": "abc"},
    {"1": "defg hi"},
    {"2": "jklm nopq r"},
  ],
  [
    {"0": "abc"},
    {"1": "defghi"},
    {"2": "jklmnopq r"},
  ],
  [
    {"0": "abc"},
    {"1": "defghi"},
    {"2": "jklmnopqr"},
  ],
];

function checkResult(result) {
  if (!(result instanceof Array)) {
    return false;
  }
  for (const item of result) {
    for (const key in item) {
      const expected = expectedResult.find((i) => Object.keys(i)[0] == key);
      if (expected === undefined || item[key] !== expected[key]) {
        return false;
      }
    }
  }
  return true;
}

test("(15 pts) implement compaction", (done) => {
  done(new Error("Not implemented"));
});

test("(15 pts) add support for distributed persistence", (done) => {
  done(new Error("Not implemented"));
});

test("(5 pts) add support for optional in-memory operation", (done) => {
  done(new Error("Not implemented"));
});

test("(15 pts) add support for iterative map-reduce", (done) => {
  done(new Error("Not implemented"));
});

beforeAll((done) => {
  fs.rmSync(path.join(__dirname, "../../store"), {recursive: true, force: true});
  fs.mkdirSync(path.join(__dirname, "../../store"));

  const groups = [
    {name: "compact", hash: util.id.consistentHash, nodes: nodeMap},
    {name: "persist", hash: util.id.consistentHash, nodes: nodeMap},
    {name: "memory", hash: util.id.consistentHash, nodes: nodeMap},
    {name: "iterative", hash: util.id.consistentHash, nodes: nodeMap},
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
