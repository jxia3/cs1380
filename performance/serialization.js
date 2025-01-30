/* A script that generates random workloads and benchmarks the serialization
   implementation. Each workload is generated from a random seed:
   - 10,000 primitive types (undefined, null, numbers, booleans, and strings).
   - 10,000 simple arrays and objects that do not contain cycles.
   - 1,000 large objects that contain complex types.
   Deserialized results are compared to the initial objects for correctness. */

const distribution = require('../config.js');
const random = require('./random.js');
