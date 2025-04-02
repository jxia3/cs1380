/* An atomic filesystem-backed key-value store built on the store module. */

const util = require("../util/util.js");

const mutexes = {};

/**
 * Reads, modifies, and writes a value in the local key-value store.
 */
function readAndModify(config, modifyFn, callback) {
  // Initialize mutex for key
  callback = callback === undefined ? (error, result) => {} : callback;
  config = util.id.getObjectConfig(config);
  const key = `${config.gid}-${config.key}`;
  if (!(key in mutexes)) {
    mutexes[key] = util.sync.createMutex();
  }

  mutexes[key].lock(() => {
    global.distribution.local.store.get(config, (error, value) => {
      // Return early if there is no value
      if (error) {
        mutexes[key].unlock(() => callback(error, null));
        return;
      }

      // Compute updated value
      let modifyResult = null;
      try {
        modifyResult = modifyFn(value);
      } catch (error) {
        mutexes[key].unlock(() => callback(error, null));
      }
      if (modifyResult?.value === undefined) {
        mutexes[key].unlock(() => callback(null, null));
        return;
      }

      // Store updated value
      global.distribution.local.store.put(modifyResult.value, config, (error, result) => {
        mutexes[key].unlock(() => {
          if (error) {
            callback(error, null);
          } else {
            callback(null, modifyResult?.state);
          }
        });
      });
    });
  });
}

module.exports = {readAndModify};
