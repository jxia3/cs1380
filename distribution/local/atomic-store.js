/** @typedef {import("../types").Callback} Callback */


/* An atomic filesystem-backed key-value store built on the store module. */

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
  const key = `${config.gid}-${config.key}`;
  if (!(key in locks)) {
    locks[key] = util.sync.createRwLock();
  }
  const storeModule = global.distribution.local.store;

  locks[key].lockWrite(() => {
    storeModule.tryGet(config, (error, exists, value) => {
      // Check if there is an error
      if (error) {
        locks[key].unlockWrite();
        operations.callback(error, null);
        return;
      }

      // Compute updated or default value
      let store = false;
      let updatedValue = null;
      let carryValue = null;
      try {
        let result = null;
        // Get the result based on whether the key exists or not
        if (exists && operations?.modify !== undefined) {
          result = operations.modify(value);
        } else if (!exists && operations?.default !== undefined) {
          result = operations.default();
        }
        if (result !== null) {
          store = true;
          updatedValue = result.value;
          carryValue = result.carry;
        }
      } catch (error) {
        locks[key].unlockWrite();
        operations.callback(error, null);
        return;
      }

      // Store updated value
      if (store) {
        storeModule.put(updatedValue, config, (error, result) => {
          locks[key].unlockWrite();
          if (error) {
            operations.callback(error, null);
          } else {
            operations.callback(null, carryValue);
          }
        });
      } else {
        locks[key].unlockWrite();
        operations.callback(null, carryValue);
      }
    });
  });
}

module.exports = {getAndModify};
