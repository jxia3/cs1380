const distribution = require("./distribution.js");

const basePort = 2000;
const nodes = [
  {ip: "127.0.0.1", port: basePort},
  {ip: "127.0.0.1", port: basePort + 1},
  {ip: "127.0.0.1", port: basePort + 2},
];

const dataset = [
  {"000": "006701199099999 1950 0515070049999999N9 +0000 1+9999"},
  {"106": "004301199099999 1950 0515120049999999N9 +0022 1+9999"},
  {"212": "004301199099999 1950 0515180049999999N9 -0011 1+9999"},
  {"318": "004301265099999 1949 0324120040500001N9 +0111 1+9999"},
  {"424": "004301265099999 1949 0324180040500001N9 +0078 1+9999"},
];

distribution.node.start(() => {
  distribution.local.status.spawn(nodes[0], (error, result) => {
    distribution.local.status.spawn(nodes[1], (error, result) => {
      distribution.local.status.spawn(nodes[2], (error, result) => {
        runTest();
      });
    });
  });
});

function runTest() {
  distribution.local.groups.put("test", [global.nodeConfig, ...nodes], (error, result) => {
    console.log("local put result", error);
    distribution.test.groups.put("test", [global.nodeConfig, ...nodes], (error, result) => {
      console.log("test put result", error);
      let cntr = 0;
      dataset.forEach((o) => {
        const key = Object.keys(o)[0];
        const value = o[key];
        distribution.test.store.put(value, key, (e, v) => {
          cntr++;
          // Once the dataset is in place, run the map reduce
          if (cntr === dataset.length) {
            doMapReduce();
          }
        });
      });
    });
  });
}

function doMapReduce() {
  console.log("doing map reduce");
}
