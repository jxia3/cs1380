/** @typedef {import("../types").Callback} Callback */

/* A service that handles crawler requests for a node group. */

const util = require('../util/util.js');

/**
 * Given a page URL, use consistentHash to determine which node is responsible 
 * for crawling it, and run the crawler on that node.
 */
function crawler(config) {
  const context = {};
  context.gid = config?.gid === undefined ? "all" : config.gid;

  function crawl(pageURL, callback) {
    global.distribution.local.groups.get(context.gid, (error, group) => {
      // Check node group
      if (error) {
        callback(error, null);
        return;
      }
      if (Object.keys(group).length === 0) {
        callback(new Error(`Group '${this.gid}' has no nodes`), null);
        return;
      }

      // Send request to node
      const node = group[util.id.applyHash(pageURL, group, util.id.consistentHash)];
      if (node?.ip === undefined || node?.port === undefined) {
        callback(new Error("Request routed to invalid node"), null);
        return;
      }
      const remote = {node, service: 'crawler', method: 'crawl'};
      global.distribution.local.comm.send([pageURL], remote, callback);
    });
  }

  return {crawl};
}


module.exports = {crawler};