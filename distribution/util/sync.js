/* A module for synchronization between asynchronous tasks. */

const log = require("./log.js");

/**
 * Creates a callback function that can only be called once.
 */
function createGuardedCallback(callback) {
  let callCount = 0;
  function guardedCallback(error, result) {
    callCount += 1;
    if (callCount > 1) {
      log(`Guarded callback called ${callCount} times`);
      return;
    }
    if (callback !== undefined) {
      callback(error, result);
    }
  }
  return guardedCallback;
}

/**
 * Creates a mutex object that exposes methods for synchronization.
 */
function createMutex() {
  const state = {locked: false};
  return {
    lock: lockMutex.bind(state),
    unlock: unlockMutex.bind(state),
  };
}

/**
 * Locks a mutex bound as the function's context.
 */
function lockMutex(callback) {
  if (this.locked === undefined) {
    throw new Error("Invalid mutex state");
  }
  if (callback === undefined) {
    throw new Error("Lock mutex received no callback");
  }
  if (this.locked) {
    setTimeout(() => lockMutex.call(this, callback), 10);
  } else {
    this.locked = true;
    callback();
  }
}

/**
 * Unlocks a mutex bound as the function's context.
 */
function unlockMutex(callback) {
  if (this.locked === undefined) {
    throw new Error("Invalid mutex state");
  }
  if (callback === undefined) {
    throw new Error("Unlock mutex received no callback");
  }
  if (!this.locked) {
    throw new Error("Mutex is not locked");
  }
  this.locked = false;
  callback();
}

module.exports = {createGuardedCallback, createMutex};
