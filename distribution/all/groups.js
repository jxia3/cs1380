/* Manages the groups known by the current node group. */

/**
 * Retrieves the node groups associated with a name for all nodes in the current group.
 */
function get(name, callback) {

}

/**
 * Adds a new node group for all nodes in the current group.
 */
function put(name, group, callback) {

}

/**
 * Removes the group associated with a name for all nodes in the current group.
 */
function del(name, callback) {

}

/**
 * Adds a node to a group for all nodes in the current group.
 */
function add(name, node, callback) {

}

/**
 * Removes a node from a group using its SID for all nodes in the current group.
 */
function rem(name, nodeSID, callback) {

}

module.exports = (config) => {
  const context = {};
  context.gid = config?.gid === undefined ? "all" : config.gid;
  return {
    get: get.bind(context),
    put: put.bind(context),
    del: del.bind(context),
    add: add.bind(context),
    rem: rem.bind(context),
  };
};
