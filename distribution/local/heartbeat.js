/* Monitors the liveness of all known peer nodes. If a node failure is detected,
   then the failure is broadcast across the network and object storage is reconfigured.
   Nodes must be manually added back into a group after recovering from a failure. */

const log = require("../util/log.js");

const EPOCH_INTERVAL = 2000;
const PING_THRESHOLD = 10;
const PING_TIMEOUT = 5000;
const FAIL_THRESHOLD = 5;
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

/**
 * Starts the heartbeat check. This internal function does not accept a callback and
 * should not be called by external services.
 */
function _start() {
  if (global?.nodeConfig?.heartbeat && currentNode !== undefined) {
    nodes[currentNode] = {state: NodeState.Alive, staleness: 0};
    setInterval(checkAlive, EPOCH_INTERVAL);
  }
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
    } else if (nodes[id].state === NodeState.Pinging) {
      if (id === currentNode) {
        throw new Error("Current node is stale");
      }
      nodes[id].staleness += 1;
    } else if (nodes[id].state === NodeState.RegisteredFailure) {
      if (nodes[id].epoch + FAIL_COOLDOWN < epoch) {
        delete nodes[id];
      }
    }
  }
  console.log("at epoch", currentNode, nodes, epoch);

  // Ping nodes to confirm liveness or declare failure
  for (const id in nodes) {
    if (nodes[id].state === NodeState.Alive && nodes[id].staleness >= PING_THRESHOLD) {
      nodes[id] = {state: NodeState.Pinging, staleness: 0};
      pingNode(id);
    }
  }

  // Advance nodes that cannot be pinged to the failed status
  for (const id in nodes) {
    if (nodes[id].state === NodeState.Pinging && nodes[id].staleness >= FAIL_THRESHOLD) {
      nodes[id] = {state: NodeState.DeclaredFailure};
      declareFailure(id);
    }
  }

  // Send gossip message with alive nodes
  const alive = {};
  for (const id in nodes) {
    if (nodes[id].state === NodeState.Alive) {
      alive[id] = nodes[id].staleness;
    }
  }
  const service = {service: "heartbeat", method: "receiveStatus"};
  global.distribution.all.gossip.send([alive], service);
}

/**
 * Sends a status request to a remote node to confirm uptime. If the node address is
 * not known, then no request is sent.
 */
function pingNode(nodeId) {
  log(`Pinging node '${nodeId}' to confirm liveness`);
  global.distribution.local.groups.get("all", (error, group) => {
    if (error) {
      console.error(error);
      return;
    }
    if (nodeId in group) {
      log(`Sending ping request to '${nodeId}' at ${JSON.stringify(group[nodeId])}`);
      const remote = {node: group[nodeId], service: "status", method: "get", timeout: PING_TIMEOUT};
      global.distribution.local.comm.send(["sid"], remote, (error, result) => {
        if (!error && nodeId in nodes && nodes[nodeId].state == NodeState.Pinging) {
          nodes[nodeId] = {state: NodeState.Alive, staleness: 0};
          log(`Confirmed liveness of node '${nodeId}'`);
        } else {
          log(`Could not confirm liveness of node '${nodeId}'`);
        }
      });
    } else {
      log(`Could not find node '${nodeId}'`);
    }
  });
}

/**
 * Updates the local liveness store with a message from an alive remote node.
 */
function receiveStatus(status, callback) {
  console.log("received status", currentNode, status);
  for (const id in status) {
    if (!(id in nodes)) {
      nodes[id] = {state: NodeState.Alive, staleness: status[id]};
      continue;
    }
    if (nodes[id].state === NodeState.Alive) {
      nodes[id].staleness = Math.min(status[id], nodes[id].staleness);
    } else if (nodes[id].state === NodeState.Pinging) {
      nodes[id] = {state: NodeState.Alive, staleness: status[id]};
    }
  }
  callback(null, null);
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

module.exports = {receiveStatus, registerFailure, _start};
