/*
    In this file, add your own test cases that correspond to functionality introduced for each milestone.
    You should fill out each test case so it adequately tests the functionality you implemented.
    You are left to decide what the complexity of each test case should be, but trivial test cases that abuse this flexibility might be subject to deductions.

    Imporant: Do not modify any of the test headers (i.e., the test('header', ...) part). Doing so will result in grading penalties.
*/

jest.setTimeout(10000);

const distribution = require("../../config.js");

let localServer = null;
const nodes = [
  {ip: "127.0.0.1", port: 2000},
  {ip: "127.0.0.1", port: 2001},
  {ip: "127.0.0.1", port: 2002},
  {ip: "127.0.0.1", port: 2003},
];
const extraNode = {ip: "127.0.0.1", port: 2004};

test("(1 pts) student test", (done) => {
  distribution.local.groups.put("foobar", nodes, (error, result) => {
    expect(error).toBeFalsy();
    expect(Object.keys(result).length).toBe(4);
    expect(Object.values(result).map((n) => n?.port))
        .toEqual(expect.arrayContaining([2000, 2001, 2002, 2003]));
    distribution.local.groups.get("all", (error, result) => {
      expect(error).toBeFalsy();
      expect(Object.keys(result).length).toBe(4);
      expect(Object.values(result).map((n) => n?.port))
          .toEqual(expect.arrayContaining([2000, 2001, 2002, 2003]));
      done();
    });
  });
});

test("(1 pts) student test", (done) => {
  distribution.foobar.groups.put("foobar", nodes, (error, result) => {
    expect(error).toEqual({});
    expect(Object.keys(result).length).toBe(4);
    for (const id in result) {
      expect(Object.keys(result[id]).length).toBe(4);
      expect(Object.values(result[id]).map((n) => n?.port))
          .toEqual(expect.arrayContaining([2000, 2001, 2002, 2003]));
    }
    done();
  });
});

test("(1 pts) student test", (done) => {
  distribution.foobar.status.spawn(extraNode, (error, result) => {
    expect(error).toBeFalsy();
    expect(result?.ip).toBe(extraNode.ip);
    expect(result?.port).toBe(extraNode.port);
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

beforeAll((done) => {
  stopNodes(() => {
    distribution.node.start((server) => {
      localServer = server;
      distribution.local.status.spawn(nodes[0], (error, result) => {
        distribution.local.status.spawn(nodes[1], (error, result) => {
          distribution.local.status.spawn(nodes[2], (error, result) => {
            distribution.local.status.spawn(nodes[3], (error, result) => {
              done();
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
          stopMethod.node = extraNode;
          distribution.local.comm.send([], stopMethod, (error, result) => {
            callback();
          });
        });
      });
    });
  });
}
