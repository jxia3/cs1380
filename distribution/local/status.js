/* Tracks the current state of the node. Note that the node ID is computed once
   on startup, and subsequent changes to the node configuration are not reflected.*/

const id = require("../util/id.js");
const log = require("../util/log.js");

const state = {
  nid: id.getNID(global.nodeConfig),
  sid: id.getSID(global.nodeConfig),
  messageCount: 0,
};
global.statusState = state;

/* Retrieves a status value on the current node. */
function get(configuration, callback) {
  if (callback === undefined) {
    return;
  }
  if (configuration === "nid") {
    callback(null, state.nid);
  } else if (configuration === "sid") {
    callback(null, state.sid);
  } else if (configuration === "ip") {
    callback(null, global.nodeConfig.ip);
  } else if (configuration === "port") {
    callback(null, global.nodeConfig.port);
  } else if (configuration === "counts") {
    callback(null, state.messageCount);
  } else if (configuration === "heapTotal") {
    callback(null, process.memoryUsage().heapTotal);
  } else if (configuration === "heapUsed") {
    callback(null, process.memoryUsage().heapUsed);
  } else {
    callback(new Error(`Status '${configuration}' not found`), null);
  }
}

function spawn(configuration, callback) {}

/* Stops the node after a 2 second cooldown. */
function stop(callback) {
  if (!global.shuttingDown) {
    log("Scheduling node shutdown");
    setTimeout(() => {
      if (global.distribution.node.server !== undefined) {
        global.distribution.node.server.close(() => {
          log("Shut down node");
          process.exit(0);
        });
      }
    }, 2000);
  }
  global.shuttingDown = true;
  callback(null, global.nodeConfig);
}

module.exports = {get, spawn, stop};
