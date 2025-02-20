/** @typedef {import("../types.js").Node} Node */
/**
 * The ID is the SHA256 hash of the JSON representation of the object.
 * @typedef {!string} ID
 */

const assert = require("assert");
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

function idToNum(id) {
  const n = parseInt(id, 16);
  assert(!isNaN(n), "idToNum: id is not in KID form!");
  return n;
}

function naiveHash(kid, nids) {
  nids.sort();
  return nids[idToNum(kid) % nids.length];
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
  naiveHash,
  consistentHash,
  rendezvousHash,
};
