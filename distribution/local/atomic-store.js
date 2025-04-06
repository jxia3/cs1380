/* An atomic filesystem-backed key-value store built on the store module. */
/** @typedef {import("../types").Callback} Callback */

const store = require("./cached-store.js");
const util = require("../util/util.js");

const locks = {};

/**
 * Expected return format of functions in an Operations object
 * @typedef {Object} ModifyResult
 * @property {any} [value] The modified value
 * @property {any} [carry] Gets passed to callback function in an Operations object
 */

/**
 * @typedef {Object} Operations
 * @property {function(): ModifyResult} [modify]
 * @property {function(): ModifyResult} [default]
 * @property {Callback} callback
 */

/**
 * Reads, modifies, and writes a value in the local key-value store.
 * @param {string | Object} config
 * @param {Operations} operations
 * @returns {void}
 */
function getAndModify(config, operations) {
  if (operations?.callback === undefined) {
    throw new Error("Read and modify received no callback");
  }

  // Get object key
  config = util.id.getObjectConfig(config);
  if (config instanceof Error) {
    operations.callback(config, null);
    return;
  }
  if (config.key === null) {
    operations.callback(new Error("Null keys are not supported"), null);
    return;
  }

  // Initialize lock for key
  const syncKey = store._getSyncKey(config.key);
  if (!(syncKey in locks)) {
    locks[syncKey] = util.sync.createRwLock();
  }
  const lock = locks[syncKey];

  lock.lockWrite(() => {
    store.tryGet(config, (error, exists, value) => {
      // Check if there is an error
      if (error) {
        lock.unlockWrite();
        operations.callback(error, null);
        return;
      }

      // Compute updated or default value
      let result = null;
      try {
        if (exists && operations?.modify !== undefined) {
          result = operations.modify(value);
        } else if (!exists && operations?.default !== undefined) {
          result = operations.default();
        }
      } catch (error) {
        lock.unlockWrite();
        operations.callback(error, null);
        return;
      }

      // Store updated value
      if (result === null || result?.value === undefined) {
        lock.unlockWrite();
        operations.callback(null, null);
        return;
      }
      store.put(result.value, config, (error, storeResult) => {
        lock.unlockWrite();
        if (error) {
          operations.callback(error, null);
        } else {
          const carry = result?.carry === undefined ? null : result.carry;
          operations.callback(null, carry);
        }
      });
    });
  });
}

module.exports = {getAndModify};
