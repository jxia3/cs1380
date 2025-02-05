const distribution = require("./distribution.js");
const util = distribution.util;

fetch("http://127.0.0.1:1234/status/get", {
  method: "PUT",
  body: util.serialize(["nid"]),
}).then((r) => r.text()).then(console.log);
