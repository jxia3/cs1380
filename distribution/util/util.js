const serialization = require("./serialization.js");
module.exports = {
  serialize: serialization.serialize,
  deserialize: serialization.deserialize,
  cache: require("./cache.js"),
  compile: require("./compile.js"),
  id: require("./id.js"),
  search: require("./search.js"),
  sync: require("./sync.js"),
  wire: require("./wire.js"),
};
