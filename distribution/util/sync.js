/* A module for synchronization between asynchronous tasks. */

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

module.exports = {createMutex};
