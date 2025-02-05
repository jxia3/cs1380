/* A script that generates random workloads and benchmarks the serialization
   implementation. Each workload is generated from a random seed:
   - 1,000,000 primitive types (undefined, null, numbers, booleans, and strings).
   - 100,000 simple arrays and objects that do not contain cycles.
   - 1,000 large arrays and objects that contain complex types.
   Deserialized results are compared to the initial objects for correctness. */

const distribution = require("../config.js");
const random = require("./random.js");

const {performance} = require("perf_hooks");

const util = distribution.util;
random.setSeed(1000);

testWorkload(generatePrimitives());
testWorkload(generateSimple());
testWorkload(generateComplex());

/* Tests a workload for performance and correctness. */
function testWorkload(values) {
  const serializeStart = performance.now();
  const serialized = [];
  for (const value of values) {
    serialized.push(util.serialize(value));
  }
  const serializeTime = performance.now() - serializeStart;

  const deserializeStart = performance.now();
  const deserialized = [];
  for (const str of serialized) {
    deserialized.push(util.deserialize(str));
  }
  const deserializeTime = performance.now() - deserializeStart;

  let correct = true;
  for (let v = 0; v < values.length; v += 1) {
    if (!checkEq(values[v], deserialized[v])) {
      correct = false;
      break;
    }
  }

  console.log("Serialize time:", serializeTime);
  console.log("Deserialize time:", deserializeTime);
  console.log("Correct:", correct);
  console.log();
}

/* Generates a workload with 1,000,000 primitive values. */
function generatePrimitives() {
  const values = [];
  for (let v = 0; v < 1_000_000; v += 1) {
    values.push(generatePrimitive());
  }
  return values;
}

/* Generates a workload with 100,000 simple objects. */
function generateSimple() {
  const values = [];
  for (let v = 0; v < 100_000; v += 1) {
    values.push(generateObject(3, 2));
  }
  return values;
}

/* Generates a workload with 1,000 complex objects. */
function generateComplex() {
  const values = [];
  for (let v = 0; v < 1000; v += 1) {
    values.push(generateObject(6, 6));
  }
  return values;
}

/* Generates a random array or object. */
function generateObject(maxLen, maxDepth) {
  if (maxDepth === 0) {
    return generateLeaf();
  }
  let len = Math.floor(random.next() * maxLen);
  if (len === 0 && maxDepth > 1) {
    len = Math.floor(random.next() * maxLen);
  }
  const values = [];
  for (let p = 0; p < len; p += 1) {
    values.push(generateObject(maxLen, maxDepth - 1));
  }

  if (random.chance(0.5)) {
    const object = {};
    for (const value of values) {
      object[generateString()] = value;
    }
    return object;
  } else {
    return values;
  }
}

/* Generates a random leaf value. */
function generateLeaf() {
  const entropy = random.next();
  if (entropy < 0.9) {
    return generatePrimitive();
  } else if (entropy < 0.95) {
    return generateDate();
  } else {
    return generateNative();
  }
}

/* Generates a random primitive value. */
function generatePrimitive() {
  const entropy = random.next();
  if (entropy < 0.05) {
    return undefined;
  } else if (entropy < 0.1) {
    return null;
  } else if (entropy < 0.4) {
    return generateNumber();
  } else if (entropy < 0.6) {
    return generateBoolean();
  } else {
    return generateString();
  }
}

/* Generates a random integer or floating point number. */
function generateNumber() {
  const num = random.next() * 100_000 - 50_000;
  if (random.chance(0.5)) {
    return Math.round(num);
  }
  return num;
}

/* Generates a random boolean. */
function generateBoolean() {
  return random.chance(0.5);
}

/* Generates a random alphanumeric string. */
function generateString() {
  let str = random.next().toString(36).slice(2);
  if (random.chance(0.2)) {
    str += random.next().toString(36).slice(2);
  }
  if (random.chance(0.2) && str.length >= 3) {
    str = str.slice(0, 3);
  }
  if (random.chance(0.2)) {
    return str.toUpperCase();
  }
  return str;
}

/* Generates a random date object. */
function generateDate() {
  const LIMIT = 1738195200000;
  const timestamp = Math.floor(random.next() * LIMIT);
  return new Date(timestamp);
}

/* Generates a random native function. */
function generateNative() {
  if (random.chance(0.5)) {
    return console.log;
  }
  return console.error;
}

/* Compares two objects for equality. */
function checkEq(a, b) {
  if (typeof a !== typeof b) {
    return false;
  }
  if (a === undefined || a === null || b === undefined || b === null) {
    return a === b;
  } else if (a instanceof Date && b instanceof Date) {
    return a.valueOf() === b.valueOf();
  } else if (typeof a === "function" && typeof b === "function") {
    return a.toString() === b.toString();
  } else if (a instanceof Error && b instanceof Error) {
    return a.message === b.message;
  } else if (a instanceof Array && b instanceof Array) {
    return a.length === b.length && a.every((v, i) => checkEq(v, b[i]));
  } else if (typeof a === "object" && typeof b === "object") {
    if (!checkEq(Object.keys(a), Object.keys(b))) {
      return false;
    }
    for (const property in a) {
      if (!checkEq(a[property], b[property])) {
        return false;
      }
    }
    return true;
  }
  return a === b;
}
