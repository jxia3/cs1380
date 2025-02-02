/*
    In this file, add your own test cases that correspond to functionality introduced for each milestone.
    You should fill out each test case so it adequately tests the functionality you implemented.
    You are left to decide what the complexity of each test case should be, but trivial test cases that abuse this flexibility might be subject to deductions.

    Imporant: Do not modify any of the test headers (i.e., the test('header', ...) part). Doing so will result in grading penalties.
*/

const distribution = require('../../config.js');
const util = distribution.util;

test('(1 pts) student test', () => {
  expect(util.deserialize(util.serialize(undefined))).toBeUndefined();
  expect(util.deserialize(util.serialize(null))).toBeNull();
  expect(util.deserialize(util.serialize(0.123456789))).toBe(0.123456789);
  expect(util.deserialize(util.serialize(false))).toBe(false);
  expect(util.deserialize(util.serialize('!@#$%^&*()_+'))).toBe('!@#$%^&*()_+');
});


test('(1 pts) student test', () => {
  const date = new Date(1000);
  expect(util.deserialize(util.serialize(date))).toEqual(date);
  const error = new Error('error message');
  expect(util.deserialize(util.serialize(error))).toEqual(error);
});


test('(1 pts) student test', () => {
  function named(a, b) {
    return a * b;
  }
  expect(util.deserialize(util.serialize(named)).toString()).toEqual(named.toString());
  const anonymous = (a, b) => a * b;
  expect(util.deserialize(util.serialize(anonymous)).toString()).toEqual(anonymous.toString());
});

test('(1 pts) student test', () => {
  const array = [{foo: 1}, {bar: 2}, {baz: 3}];
  expect(util.deserialize(util.serialize(array))).toEqual(array);
});

test('(1 pts) student test', () => {
  const object = {
    foo: [1, 2, 3],
    bar: ['4', '5', '6'],
    baz: [{7: 7}, {8: 8}, {9: 9}],
  };
  expect(util.deserialize(util.serialize(object))).toEqual(object);
});
