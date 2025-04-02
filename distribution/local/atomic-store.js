/* An atomic filesystem-backed key-value store built on the store module. */

const util = require("../util/util.js");

const locks = {};

/**
 * Reads, modifies, and writes a value in the local key-value store.
 */
function readAndModify(config, operations) {
  // Initialize lock for key
  if (operations?.callback === undefined) {
    throw new Error("Read and modify received no callback");
  }
  config = util.id.getObjectConfig(config);
  const key = `${config.gid}-${config.key}`;
  if (!(key in locks)) {
    locks[key] = util.sync.createRwLock();
  }
  const storeModule = global.distribution.store;

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
        if (exists && operations?.modify !== undefined) {
          store = true;
          const {value: modifyValue, carry} = operations.modify(value);
          updatedValue = modifyValue;
          carryValue = carry;
        } else if (!exists && operations?.default !== undefined) {
          store = true;
          updatedValue = operations.default();
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

module.exports = {readAndModify};
