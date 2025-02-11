/* Manages the routes known by the current node group. */

const remote = require("./remote.js");

module.exports = remote.createConstructor({
  put: remote.createMethod("routes", "put", 2), // put(service, name, [callback])
  rem: remote.createMethod("routes", "rem", 1), // rem(name, [callback])
});
