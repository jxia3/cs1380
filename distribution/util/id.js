/** @typedef {import("../types.js").Node} Node */
/**
 * The ID is the SHA256 hash of the JSON representation of the object.
 * @typedef {!string} ID
 */

const crypto = require("crypto");

/* Generates unique identifiers for objects using a SHA256 hash. Note that the objects
   cannot be cyclic since they are serialized as default JSON. */

/**
 * Computes the hexadecimal hash of an object serialized as JSON.
 * @param {any} object
 * @return {ID}
 */
function getID(object) {
  const hash = crypto.createHash("sha256");
  hash.update(JSON.stringify(object));
  return hash.digest("hex");
}

/**
 * Computes the ID of a node as the hash of its IP and port.
 * @param {Node} node
 * @return {ID}
 */
function getNID(node) {
  if (node?.ip === undefined || node?.port === undefined) {
    throw new Error("Node does not have an IP or port");
  }
  return getID({ip: node.ip, port: node.port});
}

/**
 * Computes the short ID of a node as the first 5 characters of its ID.
 * @param {Node} node
 * @return {ID}
 */
function getSID(node) {
  return getNID(node).substring(0, 5);
}

/**
 * Computes the ID of a message with a timestamp included for uniqueness.
 */
function getMID(message) {
  return getID({
    date: new Date().getTime(),
    mss: message,
  });
}

/**
 * Converts a hexadecimal hash to a large integer value.
 */
function idToNum(hash) {
  try {
    return parseInt(hash, 16);
  } catch (error) {
    throw new Error(`Integer conversion failed with '${error.message}'`);
  }
}

/**
 * Normalizes the group and key configuration of an object.
 */
function getObjectConfig(config, defaultGroup) {
  if (defaultGroup === undefined) {
    defaultGroup = "local";
  }
  if (typeof config === "string" || config === null) {
    config = {key: config, gid: defaultGroup};
  }

  if (typeof config === "object") {
    if (config?.key === undefined) {
      config.key = null;
    }
    if (config?.gid === undefined) {
      config.gid = defaultGroup;
    }
  }
  if (config?.key === undefined || config?.gid === undefined) {
    return new Error("Configuration does not have key or group");
  }

  return config;
}

/**
 * Applies a hash function to an item key and a group of nodes.
 */
function applyHash(key, group, hashFn) {
  const keyId = getID(key);
  const groupKeys = Object.keys(group);
  const nodeIds = groupKeys.map((key) => getNID(group[key]));
  const nodeId = hashFn(keyId, nodeIds);
  for (let n = 0; n < groupKeys.length; n += 1) {
    if (nodeIds[n] === nodeId) {
      return groupKeys[n];
    }
  }
  throw new Error("Node not found");
}

/**
 * Finds the node a key belongs to with a simple modulo operation.
 */
function naiveHash(keyId, nodeIds) {
  nodeIds = [...nodeIds];
  nodeIds.sort();
  return nodeIds[global.distribution.util.id.idToNum(keyId) % nodeIds.length];
}

/**
 * Finds the node corresponding to the ring placement of a key ID.
 */
function consistentHash(keyId, nodeIds) {
  const key = global.distribution.util.id.idToNum(keyId);
  const nodes = [];
  for (const id of nodeIds) {
    nodes.push({id, num: global.distribution.util.id.idToNum(id)});
  }
  nodes.sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

  for (let n = 0; n < nodes.length; n += 1) {
    if (key <= nodes[n].num) {
      return nodes[n].id;
    }
  }
  return nodes[0].id;
}

/**
 * Finds the node corresponding to the highest hash value.
 */
function rendezvousHash(keyId, nodeIds) {
  let maxHash = -1;
  let nodeId = nodeIds[0];
  for (const id of nodeIds) {
    const combinedKey = global.distribution.util.id.getID(`${keyId}${id}`);
    const hashNum = global.distribution.util.id.idToNum(combinedKey);
    if (hashNum > maxHash) {
      maxHash = hashNum;
      nodeId = id;
    }
  }
  return nodeId;
}

module.exports = {
  getID,
  getNID,
  getSID,
  getMID,
  idToNum,
  getObjectConfig,
  applyHash,
  naiveHash,
  consistentHash,
  rendezvousHash,
};
