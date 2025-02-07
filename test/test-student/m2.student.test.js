/*
    In this file, add your own test cases that correspond to functionality introduced for each milestone.
    You should fill out each test case so it adequately tests the functionality you implemented.
    You are left to decide what the complexity of each test case should be, but trivial test cases that abuse this flexibility might be subject to deductions.

    Imporant: Do not modify any of the test headers (i.e., the test('header', ...) part). Doing so will result in grading penalties.
*/

const distribution = require("../../config.js");
const local = distribution.local;
const util = distribution.util;

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
