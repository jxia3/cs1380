/*
    In this file, add your own test case that will confirm your correct implementation of the extra-credit functionality.
    You are left to decide what the complexity of each test case should be, but trivial test cases that abuse this flexibility might be subject to deductions.

    Imporant: Do not modify any of the test headers (i.e., the test('header', ...) part). Doing so will result in grading penalties.
*/

jest.setTimeout(60000);

const distribution = require("../../config.js");
global.nodeConfig.heartbeat = false;

const fs = require("fs");
const path = require("path");

const util = distribution.util;

let localServer = null;
const nodes = [
  {ip: "127.0.0.1", port: 2000, heartbeat: false},
  {ip: "127.0.0.1", port: 2001, heartbeat: false},
  {ip: "127.0.0.1", port: 2002, heartbeat: false},
  {ip: "127.0.0.1", port: 2003, heartbeat: false},
];
const nodeMap = {};
nodeMap[util.id.getSID(global.nodeConfig)] = global.nodeConfig;
for (const node of nodes) {
  nodeMap[util.id.getSID(node)] = node;
}

test("(15 pts) detect the need to reconfigure", (done) => {
  const firstNode = global.nodeConfig;
  const secondNode = nodes[0];
  const remote = {service: "store", method: "get"};

  try {
    distribution.foobar.store.put(["baz", "qux"], "abc1", (error, result) => {
      expect(error).toBeFalsy();
      expect(result).toEqual(["baz", "qux"]);
      expect(false).toBe(true);
      remote.node = firstNode;
      try {
        distribution.local.comm.send(["abc1"], remote, (error, result) => {
          expect(error).toBeFalsy();
          expect(result).toEqual(["baz", "qux"]);
          done();
        });
      } catch (error) {
        done(error);
      }
    });
  } catch (error) {
    done(error);
  }
});

beforeAll((done) => {
  fs.rmSync(path.join(__dirname, "../../store"), {recursive: true, force: true});
  fs.mkdirSync(path.join(__dirname, "../../store"));
  stopNodes(() => {
    distribution.node.start((server) => {
      localServer = server;
      distribution.local.status.spawn(nodes[0], (error, result) => {
        distribution.local.status.spawn(nodes[1], (error, result) => {
          distribution.local.status.spawn(nodes[2], (error, result) => {
            distribution.local.status.spawn(nodes[3], (error, result) => {
              distribution.local.groups.put("foobar", nodeMap, (error, result) => {
                distribution.foobar.groups.put("foobar", nodeMap, (error, result) => {
                  setTimeout(done, 5000);
                });
              });
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
