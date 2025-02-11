/* Manages the groups known on a node. Group names are local to the node, so different
   nodes may have different groups with the same name. */

const all = require("../all/all.js");
const id = require("../util/id.js");

const groups = {all: {}};

/**
 * Retrieves the node group associated with a name.
 */
function get(name, callback) {
  callback = callback === undefined ? (error, result) => {} : callback;
  if (!(name in groups)) {
    callback(new Error(`Group '${name}' not found`), null);
  } else {
    callback(null, groups[name]);
  }
}

/**
 * Adds a new node group with a name. Distributed methods are bound to the new group.
 */
function put(name, group, callback) {
  callback = callback === undefined ? (error, result) => {} : callback;
  if (typeof name !== "string" || name === "local") {
    callback(new Error(`Invalid group name '${name}'`, null));
  } else if (name in global.distribution && !global.distribution[name]._isGroup) {
    callback(new Error(`Global object already exists with name '${name}'`), null);
  } else {
    groups[name] = group;
    distribution[name] = {_isGroup: true};
    for (const service in all) {
      distribution[name][service] = all[service]({gid: name});
    }
    computeAllGroup();
    callback(null, group);
  }
}

/**
 * Removes the group associated with a name.
 */
function del(name, callback) {
  callback = callback === undefined ? (error, result) => {} : callback;
  if (!(name in groups)) {
    callback(new Error(`Group '${name}' not found`), null);
  } else {
    const group = groups[name];
    delete groups[name];
    computeAllGroup();
    callback(null, group);
  }
}

/**
 * Adds a node to a group. The node SID is computed locally.
 */
function add(name, node, callback) {
  callback = callback === undefined ? (error, result) => {} : callback;
  if (!(name in groups)) {
    callback(new Error(`Group '${name}' not found`), null);
  } else {
    const sid = id.getSID(node);
    groups[name][sid] = node;
    computeAllGroup();
    callback(null, groups[name]);
  }
}

/**
 * Removes a node from a group using its SID.
 */
function rem(name, nodeSID, callback) {
  callback = callback === undefined ? (error, result) => {} : callback;
  if (!(name in groups)) {
    callback(new Error(`Group '${name}' not found`), null);
  } else {
    delete groups[name][nodeSID];
    computeAllGroup();
    callback(null, groups[name]);
  }
}

/**
 * Recomputes the group of all nodes. Note that it is possible to efficiently update
 * the all mapping with extra accounting.
 */
function computeAllGroup() {
  const allNodes = {};
  for (const name in groups) {
    for (const sid in groups[name]) {
      allNodes[sid] = groups[name][sid];
    }
  }
  groups.all = allNodes;
}

module.exports = {get, put, del, add, rem};
