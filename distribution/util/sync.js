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
  const state = {
    locked: false,
    index: 0,
    waitIndex: 0,
  };
  return {
    lock: (callback) => lockMutex(state, callback),
    unlock: () => unlockMutex(state),
  };
}

/**
 * Locks a mutex passed as the function's state.
 */
function lockMutex(state, callback) {
  if (callback === undefined) {
    throw new Error("Lock mutex received no callback");
  }
  const index = state.waitIndex;
  state.waitIndex += 1;
  lockWithIndex(state, index, callback);

  function lockWithIndex(state, index, callback) {
    if (state.locked || state.index !== index) {
      setTimeout(() => lockWithIndex(state, index, callback), 5);
    } else {
      state.locked = true;
      callback();
    }
  }
}

/**
 * Unlocks a mutex passed as the function's state.
 */
function unlockMutex(state) {
  if (!state.locked) {
    throw new Error("Mutex is not locked");
  }
  state.index += 1;
  state.locked = false;
}

/**
 * Creates a reader-writer lock object that exposes methods for synchronization.
 */
function createRwLock() {
  const mutex = createMutex();
  return {
    lockRead: mutex.lock,
    unlockRead: mutex.unlock,
    lockWrite: mutex.lock,
    unlockWrite: mutex.unlock,
  };
}

module.exports = {createGuardedCallback, createMutex, createRwLock};
