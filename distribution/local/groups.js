/* Manages the groups known on a node. Group names are local to the node, so different
   nodes may have different groups with the same name. */

const groups = {};

/* Retrieves the node group associated with a name. */
function get(name, callback) {
  callback = callback === undefined ? (error, result) => {} : callback;
  if (!(name in groups)) {
    callback(new Error(`Group '${name}' not found`), null);
  } else {
    callback(null, groups[name]);
  }
}

/* Adds a new node group with a name. */
function put(name, group, callback) {
  groups[name] = group;
  if (callback !== undefined) {
    callback(group);
  }
}

function del(name, callback) {
}

function add(name, node, callback) {
}

function rem(name, node, callback) {
}

module.exports = {get, put, del, add, rem};
