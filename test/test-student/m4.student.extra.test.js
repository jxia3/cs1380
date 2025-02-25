/*
    In this file, add your own test case that will confirm your correct implementation of the extra-credit functionality.
    You are left to decide what the complexity of each test case should be, but trivial test cases that abuse this flexibility might be subject to deductions.

    Imporant: Do not modify any of the test headers (i.e., the test('header', ...) part). Doing so will result in grading penalties.
*/

jest.setTimeout(60000);

const distribution = require("../../config.js");
global.nodeConfig.heartbeat = true;

const fs = require("fs");
const path = require("path");

const util = distribution.util;

let localServer = null;
const nodes = [
  {ip: "127.0.0.1", port: 2000, heartbeat: true},
  {ip: "127.0.0.1", port: 2001, heartbeat: true},
  {ip: "127.0.0.1", port: 2002, heartbeat: true},
  {ip: "127.0.0.1", port: 2003, heartbeat: true},
];
const nodeMap = {};
nodeMap[util.id.getSID(global.nodeConfig)] = global.nodeConfig;
for (const node of nodes) {
  nodeMap[util.id.getSID(node)] = node;
}

test("(15 pts) detect the need to reconfigure", (done) => {
  const firstNode = nodes[0];
  const secondNode = global.nodeConfig;
  const getRemote = {service: "store", method: "get"};
  const getArgs = [{key: "abc1", gid: "foobar"}];
  const stopRemote = {node: nodes[2], service: "status", method: "stop"};

  distribution.foobar.store.put(["baz", "qux"], "abc1", (error, result) => {
    try {
      expect(error).toBeFalsy();
      expect(result).toEqual(["baz", "qux"]);
      distribution.local.comm.send(getArgs, {...getRemote, node: firstNode}, (error, result) => {
        try {
          expect(error).toBeFalsy();
          expect(result).toEqual(["baz", "qux"]);
          distribution.local.comm.send([], stopRemote, (error, result) => {
            distribution.local.comm.send([], stopRemote, (error, result) => {
              try {
                expect(error).toBeFalsy();
                setTimeout(() => {
                  distribution.local.comm.send(getArgs, {...getRemote, node: secondNode}, (error, result) => {
                    try {
                      expect(error).toBeFalsy();
                      expect(result).toEqual(["baz", "qux"]);
                      done();
                    } catch (error) {
                      done(error);
                    }
                  });
                }, 15000);
              } catch (error) {
                done(error);
              }
            });
          });
        } catch (error) {
          done(error);
        }
      });
    } catch (error) {
      done(error);
    }
  });
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
                  setTimeout(done, 3000);
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
    clearInterval(distribution.local.heartbeat._interval);
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
