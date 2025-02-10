/* Manages the groups known on a node. Group names are local to the node, so different
   nodes may have different groups with the same name. */

const groups = {};

function get(name, callback) {
  callback = typeof callback === "undefined" ? (error, result) => {} : callback;
  if (!(name in groups)) {
    callback(new Error(`Group '${name}' not found`), null);
  } else {
    callback(null, groups[name]);
  }
}

function put(name, group, callback) {
}

function del(name, callback) {
}

function add(name, node, callback) {
}

function rem(name, node, callback) {
}

module.exports = {get, put, del, add, rem};
