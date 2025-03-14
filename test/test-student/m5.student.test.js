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
  // Fill out this test case...
  done(new Error("Not implemented"));
});

test("(1 pts) student test", (done) => {
  // Fill out this test case...
  done(new Error("Not implemented"));
});

test("(1 pts) student test", (done) => {
  // Fill out this test case...
  done(new Error("Not implemented"));
});

test("(1 pts) student test", (done) => {
  // Fill out this test case...
  done(new Error("Not implemented"));
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
