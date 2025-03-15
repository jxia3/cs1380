/*
  In this file, add your own test cases that correspond to functionality introduced for each milestone.
  You should fill out each test case so it adequately tests the functionality you implemented.
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
  {"0": "foo bar baz"},
  {"1": "foo baz qux"},
  {"2": "foo qux corge"},
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

function wordCountMap(key, value) {
  const results = [];
  const words = value.split(" ");
  for (const word of words) {
    results.push({[word]: 1});
  }
  return results;
}

function wordCountReduce(key, values) {
  return {[key]: values.reduce((a, b) => a + b, 0)};
}

const wordCountConfig = {
  keys: dataset.flatMap((i) => Object.keys(i)),
  map: wordCountMap,
  reduce: wordCountReduce,
};

const expectedResult = [
  {"foo": 3},
  {"bar": 1},
  {"baz": 2},
  {"qux": 2},
  {"corge": 1},
];

function checkResult(result, modifier) {
  if (!(result instanceof Array)) {
    return false;
  }
  for (const item of result) {
    for (const key in item) {
      const expected = expectedResult.find((i) => Object.keys(i)[0] == key);
      if (expected === undefined) {
        return false;
      }
      if ((modifier === undefined && item[key] !== expected[key])
        || (modifier !== undefined && item[key] !== modifier(expected[key]))) {
        return false;
      }
    }
  }
  return true;
}

test("(1 pts) student test", (done) => {
  distribution.empty.mr.exec({}, (error, result) => {
    expect(error).toBeInstanceOf(Error);
    expect(result).toBeFalsy();
    distribution.empty.mr.exec({map: () => {}, reduce: () => {}}, (error, result) => {
      expect(error).toBeInstanceOf(Error);
      expect(result).toBeFalsy();
      distribution.empty.mr.exec({keys: [], map: 1, reduce: 2}, (error, result) => {
        expect(error).toBeInstanceOf(Error);
        expect(result).toBeFalsy();
        done();
      });
    });
  });
});

test("(1 pts) student test", (done) => {
  const map = (key, value) => ({[key]: value});
  const reduce = (key, values) => ({[key]: values});
  distribution.empty.mr.exec({keys: [], map, reduce}, (error, result) => {
    try {
      expect(error).toBeFalsy();
      expect(result).toEqual([]);
      done();
    } catch (error) {
      done(error);
    }
  });
});

test("(1 pts) student test", (done) => {
  createDataset("rendezvous", () => {
    distribution.rendezvous.mr.exec(wordCountConfig, (error, result) => {
      try {
        expect(error).toBeFalsy();
        expect(checkResult(result)).toBe(true);
        done();
      } catch (error) {
        done(error);
      }
    });
  });
});

test("(1 pts) student test", (done) => {
  function doubleMap(key, value) {
    const results = [];
    const words = value.split(" ");
    for (const word of words) {
      results.push({[word]: 1});
      results.push({[word]: 1});
    }
    return results;
  }

  createDataset("rendezvous", () => {
    const config = {...wordCountConfig, map: doubleMap};
    distribution.rendezvous.mr.exec(config, (error, result) => {
      try {
        expect(error).toBeFalsy();
        expect(checkResult(result, (count) => count * 2)).toBe(true);
        done();
      } catch (error) {
        done(error);
      }
    });
  });
});

test("(1 pts) student test", (done) => {
  createDataset("rendezvous", () => {
    let active = 2;
    for (let j = 0; j < active; j += 1) {
      distribution.rendezvous.mr.exec(wordCountConfig, (error, result) => {
        try {
          expect(error).toBeFalsy();
          expect(checkResult(result)).toBe(true);
          active -= 1;
          if (active === 0) {
            done();
          }
        } catch (error) {
          done(error);
        }
      });
    }
  });
});

beforeAll((done) => {
  fs.rmSync(path.join(__dirname, "../../store"), {recursive: true, force: true});
  fs.mkdirSync(path.join(__dirname, "../../store"));

  const groups = [
    {name: "empty", hash: util.id.consistentHash, nodes: nodeMap},
    {name: "rendezvous", hash: util.id.rendezvousHash, nodes: nodeMap},
    {name: "multiple", hash: util.id.consistentHash, nodes: nodeMap},
    {name: "concurrent", hash: util.id.consistentHash, nodes: nodeMap},
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
