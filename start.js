const distribution = require("./distribution.js");

const GROUP = distribution.searchParams.searchGroup;
const RESET = true;

const localNode = {
  ip: distribution.node.config.ip,
  port: distribution.node.config.port,
};
const nodes = [localNode];

distribution.node.start(() => {
  distribution.local.groups.put(GROUP, nodes, (error, result) => {
    if (error) {
      throw error;
    }
    distribution[GROUP].groups.put(GROUP, nodes, (error, result) => {
      if (Object.keys(error).length > 0) {
        throw error;
      }
      distribution[GROUP].search.start(localNode, RESET, (error, result) => {
        if (Object.keys(error).length > 0) {
          console.error(error);
        }
      });
    });
  });
});
