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

const localKey = "local_key";
const localObject = ["local", "object"];
const remoteKey = "remote_key";
const remoteObject = ["remote", "object"];

test("(1 pts) student test", (done) => {
  distribution.local.store.put(localObject, localKey, (error, result) => {
    expect(error).toBeFalsy();
    expect(result).toEqual(localObject);
    distribution.foobar.store.put(remoteObject, remoteKey, (error, result) => {
      expect(error).toBeFalsy();
      expect(result).toEqual(remoteObject);
      distribution.local.store.get(localKey, (error, result) => {
        expect(error).toBeFalsy();
        expect(result).toEqual(localObject);
        distribution.foobar.store.get(remoteKey, (error, result) => {
          expect(error).toBeFalsy();
          expect(result).toEqual(remoteObject);
          done();
        });
      });
    });
  });
});

test("(1 pts) student test", (done) => {
  localObject.push("modified");
  distribution.local.store.put(localObject, localKey, (error, result) => {
    expect(error).toBeFalsy();
    expect(result).toEqual(localObject);
    distribution.local.store.get(localKey, (error, result) => {
      expect(error).toBeFalsy();
      expect(result).toEqual(localObject);
      done();
    });
  });
});

test("(1 pts) student test", (done) => {
  remoteObject.push("modified");
  distribution.foobar.store.put(remoteObject, remoteKey, (error, result) => {
    expect(error).toBeFalsy();
    expect(result).toEqual(remoteObject);
    distribution.foobar.store.get(remoteKey, (error, result) => {
      expect(error).toBeFalsy();
      expect(result).toEqual(remoteObject);
      done();
    });
  });
});

test("(1 pts) student test", (done) => {
  distribution.local.store.del(localKey, (error, result) => {
    expect(error).toBeFalsy();
    expect(result).toEqual(localObject);
    distribution.local.store.get(localKey, (error, result) => {
      expect(error).toBeInstanceOf(Error);
      expect(result).toBeFalsy();
      distribution.local.store.put(localObject, localKey, (error, result) => {
        expect(error).toBeFalsy();
        expect(result).toEqual(localObject);
        distribution.local.store.get(localKey, (error, result) => {
          expect(error).toBeFalsy();
          expect(result).toEqual(localObject);
          done();
        });
      });
    });
  });
});

test("(1 pts) student test", (done) => {
  distribution.foobar.store.del(remoteKey, (error, result) => {
    expect(error).toBeFalsy();
    expect(result).toEqual(remoteObject);
    distribution.foobar.store.get(remoteKey, (error, result) => {
      expect(error).toBeInstanceOf(Error);
      expect(result).toBeFalsy();
      distribution.foobar.store.put(remoteObject, remoteKey, (error, result) => {
        expect(error).toBeFalsy();
        expect(result).toEqual(remoteObject);
        distribution.foobar.store.get(remoteKey, (error, result) => {
          expect(error).toBeFalsy();
          expect(result).toEqual(remoteObject);
          done();
        });
      });
    });
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
                  done();
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
