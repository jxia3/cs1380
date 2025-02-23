/* Monitors the liveness of all known peer nodes. If a node failure is detected,
   then the failure is broadcast across the network and object storage is reconfigured.
   Nodes must be manually added back into a group after recovering from a failure. */

const log = require("../util/log.js");

const EPOCH_INTERVAL = 3000;
const FAIL_THRESHOLD = 10;
const FAIL_COOLDOWN = 10;

const alive = {};
const failed = {};
const epoch = 0;

if (global?.nodeConfig?.heartbeat) {
  setInterval(checkAlive, EPOCH_INTERVAL);
}

/**
 * Sends a liveness gossip message to all known peer nodes and detects failed nodes.
 */
function checkAlive() {

}

/**
 * Broadcasts the ID of a failed node to all known peer nodes.
 */
function declareFailure(nodeId) {

}

/**
 * Removes a failed node from all node groups and reconfigures group storage.
 */
function registerFailure(nodeId) {
  if (nodeId in failed) {
    return;
  }
  failed[nodeId] = epoch;
}

module.exports = {registerFailure};
