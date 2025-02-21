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
 * Converts a hexadecimal hash to a BigInt value.
 */
function idToNum(hash) {
  try {
    if (!hash.startsWith("0x")) {
      return BigInt(`0x${hash}`);
    }
    return BigInt(hash);
  } catch (error) {
    throw new Error(`BigInt conversion failed with '${error.message}'`);
  }
}

/**
 * Normalizes the group and key configuration of an object.
 */
function getObjectConfig(config) {
  if (typeof config === "string" || config === null) {
    config = {key: config, gid: "local"};
  }
  if (typeof config === "object") {
    if (config?.key === undefined) {
      config.key = null;
    }
    if (config?.gid === undefined) {
      config.gid = "local";
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
  const nodeIds = Object.values(group).map(getNID);
  return hashFn(keyId, nodeIds);
}

/**
 * Finds the node a key belongs to with a simple modulo operation.
 */
function naiveHash(keyId, nodeIds) {
  nodeIds = [...nodeIds];
  nodeIds.sort();
  return nodeIds[idToNum(keyId) % BigInt(nodeIds.length)];
}

function consistentHash(kid, nids) {
}


function rendezvousHash(kid, nids) {
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
