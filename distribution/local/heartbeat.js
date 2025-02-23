/* Monitors the liveness of all known peer nodes. If a node failure is detected,
   then the failure is broadcast across the network and object storage is reconfigured.
   Nodes must be manually added back into a group after recovering from a failure. */

const log = require("../util/log.js");

const EPOCH_INTERVAL = 3000;
const STALE_THRESHOLD = 10;
const FAIL_COOLDOWN = 10;

// Possible liveness states for a node
const NodeState = {
  Alive: 0,
  Pinging: 1,
  DeclaredFailure: 2,
  RegisteredFailure: 3,
};

let epoch = 0;
const nodes = {};
const currentNode = global?.nodeInfo?.sid;
if (global?.nodeConfig?.heartbeat && currentNode !== undefined) {
  nodes[currentNode] = {state: NodeState.Alive, staleness: 0};
  setInterval(checkAlive, EPOCH_INTERVAL);
}

/**
 * Sends a liveness gossip message to all known peer nodes and detects failed nodes.
 */
function checkAlive() {
  // Update node states and staleness counts
  epoch += 1;
  for (const id in nodes) {
    if (nodes[id].state === NodeState.Alive) {
      if (id !== currentNode) {
        nodes[id].staleness += 1;
      }
    } else if (nodes[id].state === NodeState.RegisteredFailure) {
      if (nodes[id].epoch + FAIL_COOLDOWN < epoch) {
        delete nodes[id];
      }
    }
  }
  console.log("at epoch", nodes, epoch);

  // Ping nodes that exceed the staleness threshold

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
  for (const id in status) {
    if (id in failed) {
      continue;
    }
    if (id in alive) {
      alive[id] = Math.min(status[id], alive[id]);
    } else {
      alive[id] = status[id];
    }
  }
}

/**
 * Broadcasts the ID of a failed node to all known peer nodes.
 */
function declareFailure(nodeId) {
  console.log("declaring failure", nodeId);
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
