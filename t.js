const d = require("./distribution.js");
const bd = require("@brown-ds/distribution");

const distribution = d;

distribution.node.start(() => {
  const g = {
    "507aa": {ip: "127.0.0.1", port: 8080},
    "12ab0": {ip: "127.0.0.1", port: 8081},
  };
  distribution.local.groups.put("test", g, (error, result) => {
    console.log(error, result);
    console.log(bd.test);
  });
});
