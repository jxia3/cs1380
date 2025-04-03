/** @typedef {import("../types").Callback} Callback */

/* A service that handles crawler requests for a node group. */

const util = require('../util/util.js');
const remote = require("./remote-service.js");

const QUEUE_KEY = "crawl-queue";

/**
 * Given a page URL, use consistentHash to determine which node is responsible 
 * for crawling it, add it to that node's queue, and make a crawl call to that node.
 * @param {string} pageURL
 * @param {Callback} callback
 */
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
    // First update that node's queue
    const storeRemote = {node, service: 'atomicStore', method: 'getAndModify'};
    const operations = {
      modify: (queue) => {
        queue.push(pageURL);
        return {
          value: queue,
          carry: null,
        };
      },
      default: () => {
        return {
          value: [pageURL]
        }
      },
      callback: (error, result) => {
        callback(error, null);
      },
    }

    global.distribution.local.comm.send()

    const remote = {node, service: 'crawler', method: 'crawl'};
    global.distribution.local.comm.send([pageURL], remote, callback);
  });
}


module.exports = remote.createConstructor({crawl});