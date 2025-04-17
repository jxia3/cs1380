const distribution = require("./distribution.js");
const run = require("./run.js");

const GROUP = distribution.searchParams.searchGroup;

const localNode = {
  ip: distribution.node.config.ip,
  port: distribution.node.config.port,
};
// const nodes = [localNode];
const query = "google";

const offset = [0, 10];
const addresses = [
  "3.148.206.79", "52.14.50.72", "3.147.45.181", "3.135.210.183", "3.148.226.105",
  "13.58.71.61", "18.116.14.107", "3.148.248.72", "3.128.172.56", "3.137.198.123",
];
const nodes = addresses.slice(offset[0], offset[1]).map((n) => ({ip: n, port: 80}));

// distribution.node.start(() => {
//   distribution.local.groups.put(GROUP, [distribution.node.config], (error, result) => {
//     if (error) {
//       throw error;
//     }
//     setTimeout(() => {
//       distribution.local.query.dihQuery("distributed systems", console.log);
//     }, 100);
//   });
// });

run.startGroup(10, () => {
  setTimeout(() => {
    distribution.local.query.runSearch();
  }, 1000);
})
