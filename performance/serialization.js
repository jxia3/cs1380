/* A script that generates random workloads and benchmarks the serialization
   implementation. Each workload is generated from a random seed:
   - 10,000 primitive types (undefined, null, numbers, booleans, and strings).
   - 10,000 simple arrays and objects that do not contain cycles.
   - 1,000 large objects that contain complex types.
   Deserialized results are compared to the initial objects for correctness. */

//const distribution = require('../config.js');
const random = require('./random.js');

//const util = distribution.util;
random.setSeed(1000);

for (let p = 0; p < 1000; p += 1) {
   console.log(generatePrimitive())
}

/* Generates a random array or object. */
function generateObject(maxLen, maxDepth) {

}

/* Generates a random leaf value. */
function generateLeaf() {

}

/* Generates a random primitive value. */
function generatePrimitive() {
   const entropy = random.next()
   if (entropy < 0.05) {
      return undefined
   } else if (entropy < 0.1) {
      return null
   } else if (entropy < 0.4) {
      return generateNumber()
   } else if (entropy < 0.6) {
      return generateBoolean()
   } else {
      return generateString()
   }
}

/* Generates a random integer or floating point number. */
function generateNumber() {
   const num = random.next() * 100_000 - 50_000
   if (random.chance(0.5)) {
      return Math.round(num)
   }
   return num
}

/* Generates a random boolean. */
function generateBoolean() {
   return random.chance(0.5)
}

/* Generates a random alphanumeric string. */
function generateString() {
   let str = random.next().toString(36).slice(2)
   if (random.chance(0.2)) {
      str += random.next().toString(36).slice(2)
   }
   if (random.chance(0.2) && str.length >= 3) {
      str = str.slice(0, 3)
   }
   if (random.chance(0.2)) {
      return str.toUpperCase()
   }
   return str
}

/* Generates a random date object. */
function generateDate() {
   const LIMIT = 1738195200000
   const timestamp = Math.floor(random.next() * LIMIT)
   return new Date(timestamp)
}

/* Generates a random native function. */
function generateNative() {
   if (random.chance(0.5)) {
      return console.log
   }
   return console.error
}