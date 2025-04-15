const distribution = require("./distribution.js");

const GROUP = distribution.searchParams.searchGroup;

const localNode = {
  ip: distribution.node.config.ip,
  port: distribution.node.config.port,
};
// const nodes = [localNode];
const query = "google";

const offset = [0, 10];
const addresses = [
  "3.139.81.183", "3.149.2.194", "18.217.66.8", "3.15.220.99", "3.147.63.105",
  "18.226.159.174", "18.117.185.42", "18.223.196.60", "3.139.108.222", "3.16.66.233",
];
const nodes = addresses.slice(offset[0], offset[1]).map((n) => ({ip: n, port: 80}));

distribution.node.start(() => {
  distribution.local.groups.put(GROUP, [distribution.node.config], (error, result) => {
    if (error) {
      throw error;
    }
    setTimeout(() => {
      distribution.local.queryPerf.query("lebron", console.log);
    }, 100);
  });
});
