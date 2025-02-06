/** @typedef {import("../types").Callback} Callback */

/* Manages the services available on the node. Note that dynamic services are stored
   in a mapping separate from the local module to avoid overwriting core functionality. */

const services = {};

/**
 * @param {string} configuration
 * @param {Callback} callback
 * @return {void}
 */
function get(configuration, callback) {
  if (callback === undefined) {
    return;
  }
  if (configuration in services) {
    callback(null, services[configuration]);
  } else {
    callback(new Error(`Service '${configuration}' not found`), null);
  }
}

/**
 * @param {object} service
 * @param {string} configuration
 * @param {Callback} callback
 * @return {void}
 */
function put(service, configuration, callback) {
  services[configuration] = service;
  if (callback !== undefined) {
    callback(null, service);
  }
}

/**
 * @param {string} configuration
 * @param {Callback} callback
 */
function rem(configuration, callback) {
  let service = null;
  if (configuration in services) {
    service = services[configuration];
    delete services[configuration];
  }
  if (callback !== undefined) {
    callback(null, service);
  }
};

module.exports = {get, put, rem};
