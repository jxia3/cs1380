/* Manages the groups known on a node. Group names are local to the node, so different
   nodes may have different groups with the same name. */

const all = require("../all/all.js");
const util = require("../util/util.js");

const groups = {all: {}};

/**
 * Retrieves the node group associated with a name.
 */
function get(name, callback) {
  if (callback === undefined) {
    return;
  }
  if (!(name in groups)) {
    callback(new Error(`Group '${name}' not found`), null);
  } else {
    callback(null, groups[name]);
  }
}

/**
 * Adds a new node group with a name. Distributed methods are bound to the new group.
 */
function put(config, group, callback) {
  callback = callback === undefined ? (error, result) => {} : callback;
  const name = typeof config === "string" ? config : config?.gid;
  if (typeof name !== "string" || name === "local") {
    callback(new Error(`Invalid group name '${name}'`, null));
    return;
  }
  if (name in global.distribution && !global.distribution[name]._isGroup) {
    callback(new Error(`Global object already exists with name '${name}'`), null);
    return;
  }

  // Construct node mapping
  let nodes = {};
  if (group instanceof Array) {
    for (const node of group) {
      const sid = util.id.getSID(node);
      nodes[sid] = node;
    }
  } else if (typeof nodes === "object") {
    nodes = group;
  } else {
    callback(new Error("Invalid nodes object"), null);
    return;
  }

  // Remove start functions
  for (const id in nodes) {
    if (nodes[id]?.onStart !== undefined) {
      delete nodes[id]?.onStart;
    }
  }

  // Add group and recompute the all group
  groups[name] = nodes;
  global.distribution[name] = {_isGroup: true};
  const subset = typeof config === "object" ? config?.subset : undefined;
  for (const service in all) {
    global.distribution[name][service] = all[service]({gid: name, subset});
  }
  computeAllGroup();

  callback(null, nodes);
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
    if (node.onStart !== undefined) {
      delete node.onStart;
    }
    const sid = util.id.getSID(node);
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
