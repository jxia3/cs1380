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
  } else if (config.gid in global.distribution && global.distribution[config.gid]?._isGroup) {
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
 * @param {string} name
 * @param {Callback} callback
 * @return {void}
 */
function put(service, name, callback) {
  callback = callback === undefined ? (error, result) => {} : callback;
  if (typeof name === "object") {
    callback(new Error("Service name cannot be an object"), null);
  }
  services[name] = service;
  callback(null, name);
}

/**
 * Deletes a dynamic service on the current node.
 * @param {string} name
 * @param {Callback} callback
 */
function rem(name, callback) {
  callback = callback === undefined ? (error, result) => {} : callback;
  if (typeof name === "object") {
    callback(new Error("Service name cannot be an object"), null);
  }
  let service = null;
  if (name in services) {
    service = services[name];
    delete services[name];
  }
  callback(null, service);
};

module.exports = {get, put, rem};
