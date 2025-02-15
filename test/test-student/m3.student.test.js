/*
    In this file, add your own test cases that correspond to functionality introduced for each milestone.
    You should fill out each test case so it adequately tests the functionality you implemented.
    You are left to decide what the complexity of each test case should be, but trivial test cases that abuse this flexibility might be subject to deductions.

    Imporant: Do not modify any of the test headers (i.e., the test('header', ...) part). Doing so will result in grading penalties.
*/

jest.setTimeout(10000);

const distribution = require("../../config.js");

const util = distribution.util;

let localServer = null;
const nodes = [
  {ip: "127.0.0.1", port: 2000},
  {ip: "127.0.0.1", port: 2001},
  {ip: "127.0.0.1", port: 2002},
  {ip: "127.0.0.1", port: 2003},
];
const extraNode = {ip: "127.0.0.1", port: 2004};

test("(1 pts) student test", (done) => {
  const groupConfig = {gid: "foobar", subset: (l) => 5};
  distribution.local.groups.put(groupConfig, nodes, (error, result) => {
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
    distribution.foobar.groups.get("foobar", (error, result) => {
      expect(Object.keys(error).length).toBe(1);
      expect(Object.values(error).every((e) => e instanceof Error)).toBe(true);
      expect(Object.keys(result).length).toBe(4);
      distribution.foobar.groups.put(
          {gid: "foobar", subset: (l) => 5},
          [...nodes, extraNode],
          (error, result) => {
            expect(error).toEqual({});
            expect(Object.keys(result).length).toBe(5);
            for (const id in result) {
              expect(Object.keys(result[id]).length).toBe(5);
              expect(Object.values(result[id]).map((n) => n?.port))
                  .toEqual(expect.arrayContaining([2000, 2001, 2002, 2003, 2004]));
            }
            done();
          },
      );
    });
  });
});

test("(1 pts) student test", (done) => {
  let count = 0;
  function increment(callback) {
    count += 1;
    callback(null, count);
  }
  const counterService = {increment: util.wire.createRPC(increment)};

  distribution.foobar.routes.put(counterService, "counter", (error, result) => {
    expect(error).toEqual({});
    expect(Object.keys(result).length).toBe(5);
    expect(Object.values(result).every((n) => n === "counter"));
    const service = {service: "counter", method: "increment"};
    distribution.foobar.comm.send([], service, (error, result) => {
      expect(error).toEqual({});
      expect(Object.keys(result).length).toBe(5);
      expect(Object.values(result)).toEqual(expect.arrayContaining([1, 2, 3, 4, 5]));
      done();
    });
  });
});

test("(1 pts) student test", (done) => {
  let count = 0;
  function increment(callback) {
    count += 1;
    callback(null, count);
  }
  const counterService = {increment: util.wire.createRPC(increment)};

  distribution.local.routes.put(counterService, "counter", (error, result) => {
    expect(error).toBeFalsy();
    expect(result).toBe("counter");
    distribution.foobar.gossip.send(
        [[], {node: global.nodeConfig, service: "counter", method: "increment"}],
        {service: "comm", method: "send"},
        (error, result) => {
          console.log(error, result)
          expect(error).toEqual({});
          expect(Object.keys(result).length).toBe(5);
          expect(Object.values(result)).toEqual(expect.arrayContaining([1, 2, 3, 4, 5]));
          done();
        },
    );
  });
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
