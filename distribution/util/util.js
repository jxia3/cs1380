const compile = require("./compile.js");
const id = require("./id.js");
const serialization = require("./serialization.js");
const wire = require("./wire.js");

module.exports = {
  serialize: serialization.serialize,
  deserialize: serialization.deserialize,
  compile,
  id,
  wire,
};
