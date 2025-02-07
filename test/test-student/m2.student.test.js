/*
    In this file, add your own test cases that correspond to functionality introduced for each milestone.
    You should fill out each test case so it adequately tests the functionality you implemented.
    You are left to decide what the complexity of each test case should be, but trivial test cases that abuse this flexibility might be subject to deductions.

    Imporant: Do not modify any of the test headers (i.e., the test('header', ...) part). Doing so will result in grading penalties.
*/

const distribution = require("../../config.js");
const id = distribution.util.id;
const local = distribution.local;
const node = distribution.node;
const util = distribution.util;

test("(1 pts) student test", (done) => {
  const remote = {node: node.config, service: "status", method: "get"};
  local.status.get("counts", (error, startCount) => {
    expect(error).toBeFalsy();
    local.comm.send(["nid"], remote, (error, nid) => {
      expect(error).toBeFalsy();
      expect(nid).toBe(id.getNID(node.config));
      local.comm.send(["ip"], remote, (error, ip) => {
        expect(error).toBeFalsy();
        expect(ip).toBe(node.config.ip);
        local.status.get("counts", (error, endCount) => {
          expect(error).toBeFalsy();
          expect(endCount).toBe(startCount + 2);
          done();
        });
      });
    });
  });
});

test("(1 pts) student test", (done) => {
  local.routes.get("foobar", (error, result) => {
    expect(error).toBeInstanceOf(Error);
    expect(result).toBeFalsy();
    local.routes.put(37, "foobar", (error, result) => {
      expect(error).toBeFalsy();
      expect(result).toBe("foobar");
      local.routes.get("foobar", (error, result) => {
        expect(error).toBeFalsy();
        expect(result).toBe(37);
        local.routes.rem("foobar", (error, result) => {
          expect(error).toBeFalsy();
          expect(result).toBe(37);
          local.routes.get("foobar", (error, result) => {
            expect(error).toBeInstanceOf(Error);
            expect(result).toBeFalsy();
            done();
          });
        });
      });
    });
  });
});

test("(1 pts) student test", (done) => {
  const service = {get: (configuration, callback) => callback(null, null)};
  const remote = {node: node.config, service: "status", method: "get"};
  local.routes.get("status", (error, result) => {
    expect(error).toBeFalsy();
    expect(result).toBe(local.status);
    local.routes.put(service, "status", (error, result) => {
      expect(error).toBeFalsy();
      expect(result).toBe("status");
      local.comm.send(["nid"], remote, (error, result) => {
        expect(error).toBeNull();
        expect(result).toBeNull();
        local.status.get("nid", (error, result) => {
          expect(error).toBeFalsy();
          expect(result).toBe(id.getNID(node.config));
          local.routes.put(local.status, "status");
          done();
        });
      });
    });
  });
});

test("(1 pts) student test", (done) => {
  let value = 0;
  function increment(amount, callback) {
    value += amount;
    callback(null, value);
  }

  const stub = util.wire.createRPC(increment);
  expect(typeof stub).toBe("function");
  stub(1, (error, value) => {
    expect(error).toBeFalsy();
    expect(value).toBe(1);
    stub(2, (error, value) => {
      expect(error).toBeFalsy();
      expect(value).toBe(3);
      done();
    });
  });
});

test("(1 pts) student test", (done) => {
  const remote = {node: node.config, service: "status", method: "get"};
  function getNodeInfo(callback) {
    local.comm.send(["nid"], remote, (error, nid) => {
      if (error) {
        callback(error, null);
        return;
      }
      local.comm.send(["sid"], remote, (error, sid) => {
        if (error) {
          callback(error, null);
          return;
        }
        callback(null, [nid, sid]);
      });
    });
  }

  const stub = util.wire.createRPC(getNodeInfo);
  expect(typeof stub).toBe("function");
  stub((error, result) => {
    expect(error).toBeFalsy();
    expect(result).toEqual([id.getNID(node.config), id.getSID(node.config)]);
    done();
  });
});

let localServer = null;

beforeAll((done) => {
  distribution.node.start((server) => {
    localServer = server;
    done();
  });
});

afterAll((done) => {
  localServer.close();
  done();
});
