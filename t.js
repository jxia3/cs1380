const distribution = require("./distribution.js");
const util = distribution.util;

fetch("http://127.0.0.1:1234/status/get", {
  method: "PUT",
  body: util.serialize(["nid"]),
}).then((r) => r.text()).then(console.log);

fetch("http://127.0.0.1:1234/status/get", {
  method: "PUT",
  body: util.serialize(["nid"]),
}).then((r) => r.text()).then(console.log);

fetch("http://127.0.0.1:1234/status/get", {
  method: "PUT",
  body: util.serialize(["nid"]),
}).then((r) => r.text()).then(console.log);

for (let i = 0; i < 1000; i += 1) {}

fetch("http://127.0.0.1:1234/status/get", {
  method: "PUT",
  body: util.serialize(["counts"]),
}).then((r) => r.text()).then(console.log);