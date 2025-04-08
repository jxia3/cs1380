const distribution = require("./distribution.js");

const GROUP = distribution.searchParams.searchGroup;
const RESET = true;

const localNode = {
  ip: distribution.node.config.ip,
  port: distribution.node.config.port,
};
const nodes = [localNode];
const urls = ["https://deepmind.google"];
const query = "google ai model";

distribution.node.start(() => {
  distribution.local.groups.put(GROUP, nodes, (error, result) => {
    if (error) {
      throw error;
    }
    distribution[GROUP].groups.put(GROUP, nodes, (error, result) => {
      if (Object.keys(error).length > 0) {
        throw error;
      }
      setTimeout(() => {
        const terms = distribution.util.search.calcTerms("google ai model").terms;
        distribution[GROUP].query2.lookupTerms(terms, console.log);
      }, 100);
    });
  });
});
