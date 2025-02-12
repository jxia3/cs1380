/* Receives and redistributes gossip messages. */

const received = {};

/**
 * Receives and dispatches a gossip message. The message is redistributed among the group
 * of nodes specified in the message.
 */
function receive(message, callback) {
  console.log("received gossip", message);
  process.exit(0);
}

module.exports = {recv: receive};
