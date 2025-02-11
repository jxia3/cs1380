/* Queries or modifies the state of all the nodes in a group. */

/**
 * Retrieves a status value for each node in the current group.
 */
function get(item, callback) {

}

/**
 * Creates a new node in a child process with a configuration. The node information is
 * sent to all the nodes in the current group.
 */
function spawn(config, callback) {

}

/**
 * Stops all the nodes in the current group including the current node.
 */
function stop(callback) {

}

module.exports = (config) => {
  const context = {};
  context.gid = config?.gid === undefined ? "all" : config.gid;
  return {
    get: get.bind(context),
    spawn: spawn.bind(context),
    stop: stop.bind(context),
  };
};
