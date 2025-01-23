/*
    In this file, add your own test cases that correspond to functionality introduced for each milestone.
*/

const distribution = require('../config.js');

// M1 Test Cases

test('m1: sample test', () => {
  const object = {milestone: 'm1', status: 'complete'};
  const serialized = distribution.util.serialize(object);
  const deserialized = distribution.util.deserialize(serialized);

  expect(deserialized).toEqual(object);
});

// M2 Test Cases

// M3 Test Cases

// M4 Test Cases

// M5 Test Cases
