const distribution = require("./distribution.js");

const GROUP = distribution.util.search.GROUP;
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
      if (error) {
        throw error;
      }
      distribution[GROUP].search.start(localNode, RESET, (error, result) => {
        if (error) {
          console.error(error);
        }
      });
    });
  });
});
