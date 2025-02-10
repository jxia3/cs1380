/** @typedef {import("../types").Callback} Callback */

/* Manages the services available on the node. Note that dynamic services are stored
   in a mapping separate from the local module to avoid overwriting core functionality.
   Distributed services stored in the global object can also be retrieved. */

const services = {};

/**
 * Retrieves a dynamic service on the current node.
 * @param {any} config
 * @param {Callback} callback
 * @return {void}
 */
function get(config, callback) {
  // Parse configuration
  if (callback === undefined) {
    return;
  }
  if (typeof config === "string") {
    config = {service: config, gid: "local"};
  }
  if (config.service === undefined) {
    callback(new Error("Service not specified"), null);
    return;
  }
  if (config.gid === undefined) {
    config.gid = "local";
  }

  if (config.gid === "local") {
    // Find local service
    if (config.service in services) {
      callback(null, services[config.service]);
    } else {
      callback(new Error(`Service '${config.service}' not found in group 'local'`), null);
    }
  } else if (config.gid in global.distribution) {
    // Find distributed service
    if (config.service in global.distribution[config.gid]) {
      callback(null, global.distribution[config.gid][config.service]);
    } else {
      callback(new Error(`Service '${config.service}' not found in group '${config.gid}'`), null);
    }
  } else {
    callback(new Error(`Group '${config.gid}' not found`), null);
  }
}

/**
 * Sets a dynamic service on the current node.
 * @param {object} service
 * @param {string} config
 * @param {Callback} callback
 * @return {void}
 */
function put(service, config, callback) {
  callback = callback === undefined ? (error, result) => {} : callback;
  if (typeof config !== "string") {
    callback(new Error("Service name must be a string"), null);
  }
  services[config] = service;
  callback(null, config); // todo: check
}

/**
 * Deletes a dynamic service on the current node.
 * @param {string} config
 * @param {Callback} callback
 */
function rem(config, callback) {
  callback = callback === undefined ? (error, result) => {} : callback;
  if (typeof config !== "string") {
    callback(new Error("Service name must be a string"), null);
  }
  let service = null;
  if (config in services) {
    service = services[config];
    delete services[config];
  }
  callback(null, service);
};

module.exports = {get, put, rem};
