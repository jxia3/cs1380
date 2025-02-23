/* Monitors the liveness of all known peer nodes. If a node failure is detected,
   then the failure is broadcast across the network and object storage is reconfigured.
   Nodes must be manually added back into a group after recovering from a failure. */

const log = require("../util/log.js");

const EPOCH_INTERVAL = 3000;
const FAIL_THRESHOLD = 10;
const FAIL_COOLDOWN = 10;

// Possible states for a failed node
const FailState = {
  Declared: 0,
  Registered: 1,
};

let epoch = 0;
const alive = {};
const failed = {};

const currentNode = global?.nodeInfo?.sid;
if (global?.nodeConfig?.heartbeat && currentNode !== undefined) {
  alive[currentNode] = 0;
  setInterval(checkAlive, EPOCH_INTERVAL);
}

/**
 * Sends a liveness gossip message to all known peer nodes and detects failed nodes.
 */
function checkAlive() {
  // Manage staleness counts and failed cache
  epoch += 1;
  for (const id in alive) {
    if (id in failed) {
      delete alive[id];
      continue;
    }
    if (id !== currentNode) {
      alive[id] += 1;
    }
  }
  for (const id in failed) {
    if (failed[id].epoch + FAIL_COOLDOWN < epoch) {
      delete failed[id];
    }
  }

  // Send gossip message
  const service = {service: "heartbeat", method: "receiveStatus"};
  global.distribution.all.gossip.send([alive], service, (errors, results) => {
    for (const nodeId in errors) {
      console.error(errors[nodeId]);
    }
  });

  // Check for failed nodes
  for (const id in alive) {
    if (id in failed) {
      delete alive[id];
      continue;
    }
    if (alive[id] >= FAIL_THRESHOLD) {
      delete alive[id];
      failed[id] = {state: FailState.Declared, epoch};
      declareFailure(id);
    }
  }
}

/**
 * Updates the local liveness store with a message from an alive remote node.
 */
function receiveStatus(status, callback) {

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

module.exports = {receiveStatus, registerFailure};
