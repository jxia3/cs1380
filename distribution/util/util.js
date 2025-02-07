const id = require("./id.js");
const serialization = require("./serialization.js");
const wire = require("./wire.js");

module.exports = {
  serialize: serialization.serialize,
  deserialize: serialization.deserialize,
  id: id,
  wire: wire,
};
