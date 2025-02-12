/* Receives and redistributes gossip messages. */

const MAX_LEN = 1000;

const receivedSet = new Set();
const receivedQueue = [];

/**
 * Receives and dispatches a gossip message. The message is redistributed among the group
 * of nodes specified in the message.
 */
function receive(payload, callback) {
  callback = callback === undefined ? (error, result) => {} : callback;
  if (payload?.gossipId === undefined || payload?.config?.service === undefined
      || payload?.config?.method === undefined || payload?.message === undefined
      || payload?.groupId === undefined) {
    callback(new Error("Invalid gossip payload"), null);
    return;
  }
  if (checkReceived(payload.gossipId)) {
    callback(null, null);
  }
  const remote = {...payload.config, ip: global.nodeConfig.ip, port: global.nodeConfig.port};
  global.distribution.local.comm.send(payload.message, remote, callback);
  if (global.distribution[payload.groupId]?._isGroup) {
    global.distribution[payload.groupId].gossip.send(payload.message, payload.config);
  }
}

/**
 * Checks if a message has been received and updates the set and queue.
 */
function checkReceived(gossipId) {
  if (receivedSet.has(gossipId)) {
    return true;
  }
  receivedSet.add(gossipId);
  receivedQueue.push(gossipId);
  if (receivedQueue.length > MAX_LEN) {
    const removed = receivedQueue.shift();
    receivedSet.delete(removed);
  }
}

module.exports = {recv: receive};
