/* An atomic filesystem-backed key-value store built on the store module. */

const util = require("../util/util.js");

const locks = {};

/**
 * Reads, modifies, and writes a value in the local key-value store.
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
        if (exists && operations?.modify !== undefined) {
          const modifyResult = operations.modify(value);
          if (modifyResult !== null) {
            store = true;
            updatedValue = modifyResult.value;
            carryValue = modifyResult.carry;
          }
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

module.exports = {getAndModify};
