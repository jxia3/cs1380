/* Tracks the current state of the node. Note that the node ID is computed once
   on startup, and subsequent changes to the node configuration are not reflected.*/

const id = require("../util/id");

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

function stop(callback) {}

module.exports = {get, spawn, stop};
