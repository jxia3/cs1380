const distribution = require("./distribution.js");

const basePort = 2000;
const nodes = [
  {ip: "127.0.0.1", port: basePort},
  {ip: "127.0.0.1", port: basePort + 1},
  {ip: "127.0.0.1", port: basePort + 2},
];

const dataset = [
  {"0004": "006701199099999 1950 0515070049999999N9 +0000 1+9999"},
  {"1064": "004301199099999 1950 0515120049999999N9 +0022 1+9999"},
  {"2124": "004301199099999 1950 0515180049999999N9 -0011 1+9999"},
  {"3184": "004301265099999 1949 0324120040500001N9 +0111 1+9999"},
  {"4244": "004301265099999 1949 0324180040500001N9 +0078 1+9999"},
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
  const groupConfig = {gid: "test", hash: distribution.util.id.consistentHash};
  distribution.local.groups.put(groupConfig, [global.nodeConfig, ...nodes], (error, result) => {
    console.log("local put result", error);
    distribution.test.groups.put(groupConfig, [global.nodeConfig, ...nodes], (error, result) => {
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
  const mapper = (key, value) => {
    const words = value.split(/(\s+)/).filter((e) => e !== " ");
    const out = {};
    out[words[1]] = parseInt(words[3]);
    return [out];
  };

  const reducer = (key, values) => {
    const out = {};
    out[key] = values.reduce((a, b) => Math.max(a, b), -Infinity);
    return out;
  };

  distribution.test.store.get(null, (error, keys) => {
    console.log(keys);
    distribution.test.mr.exec({keys, map: mapper, reduce: reducer, compact: reducer}, (e, v) => {
      console.log(e, v);
    });
  });
}
