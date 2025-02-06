/** @typedef {import("../types").Callback} Callback */

/* Manages the services available on the node. Note that dynamic services are stored
   in a mapping separate from the local module to avoid overwriting core functionality. */

const services = {};

/**
 * @param {string} name
 * @param {Callback} callback
 * @return {void}
 */
function get(name, callback) {
  if (callback === undefined) {
    return;
  }
  if (name in services) {
    callback(null, services[name]);
  } else {
    callback(new Error(`Service '${name}' not found`), null);
  }
}

/**
 * @param {object} service
 * @param {string} name
 * @param {Callback} callback
 * @return {void}
 */
function put(service, name, callback) {
  services[name] = service;
  if (callback !== undefined) {
    callback(null, service);
  }
}

/**
 * @param {string} name
 * @param {Callback} callback
 */
function rem(name, callback) {
  let service = null;
  if (name in services) {
    service = services[name];
    delete services[name];
  }
  if (callback !== undefined) {
    callback(null, service);
  }
};

module.exports = {get, put, rem};
