/** @typedef {import("../types").Callback} Callback */

/**
 * NOTE: This Target is slightly different from local.all.Target
 * @typdef {Object} Target
 * @property {string} service
 * @property {string} method
 */

/**
 * @param {object} config
 * @return {object}
 */
function comm(config) {
  const context = {};
  context.gid = config.gid || "all";

  /**
   * @param {Array} message
   * @param {object} config
   * @param {Callback} callback
   */
  function send(message, config, callback) {
  }

  return {send};
};

module.exports = comm;
