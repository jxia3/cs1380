/* Tracks the current state of the node. Note that the node ID is computed once
   on startup, and subsequent changes to the node configuration are not reflected.*/

const log = require("../util/log.js");
const util = require("../util/util.js");

const childProcess = require("child_process");
const fs = require("fs");
const path = require("path");

// Initialize internal state
const state = {
  nid: util.id.getNID(global.nodeConfig),
  sid: util.id.getSID(global.nodeConfig),
  messageCount: 0,
};

// Set global state and create store directory
global.statusState = state;
global.nodeInfo = {
  nid: state.nid,
  sid: state.sid,
  storePath: path.join(__dirname, `../../store/${state.sid}`),
};
fs.mkdir(global.nodeInfo.storePath, {recursive: true}, (error, result) => {
  if (error) {
    console.error(error);
  }
});

/**
 * Retrieves a status value on the current node.
 */
function get(item, callback) {
  if (callback === undefined) {
    return;
  }
  if (item === "nid") {
    callback(null, state.nid);
  } else if (item === "sid") {
    callback(null, state.sid);
  } else if (item === "ip") {
    callback(null, global.nodeConfig.ip);
  } else if (item === "port") {
    callback(null, global.nodeConfig.port);
  } else if (item === "counts") {
    callback(null, state.messageCount);
  } else if (item === "heapTotal") {
    callback(null, process.memoryUsage().heapTotal);
  } else if (item === "heapUsed") {
    callback(null, process.memoryUsage().heapUsed);
  } else {
    callback(new Error(`Status item '${item}' not found`), null);
  }
}

/**
 * Creates a new node in a child process with a configuration.
 */
function spawn(config, callback) {
  config.onStart = createStartFn(config.onStart, callback);
  const file = path.join(__dirname, "../../distribution.js");
  childProcess.spawn("node", [file, "--config", util.serialize(config)], {
    detached: true,
    stdio: "inherit",
  });
}

/**
 * Creates a start hook that calls a locally registered RPC function.
 */
function createStartFn(onStart, callback) {
  if (callback === undefined) {
    return;
  }
  const nodeStart = onStart === undefined ? () => {} : onStart;
  const externalStart = util.wire.createRPC((...args) => {
    const remoteCallback = args.pop();
    callback(...args);
    remoteCallback(null, null);
  });

  function startFn(server) {
    const nodeStart = "__NODE_START__";
    const externalStart = "__EXTERNAL_START__";
    try {
      nodeStart(server);
    } catch (error) {
      console.error(error);
    }
    try {
      const config = {...global.nodeConfig};
      if (config.onStart !== undefined) {
        delete config.onStart;
      }
      externalStart(null, config, (error, result) => {});
    } catch (error) {
      externalStart(error, null, (error, result) => {});
    }
  }

  return util.compile(startFn, {
    "__NODE_START__": nodeStart,
    "__EXTERNAL_START__": externalStart,
  });
}

/**
 * Stops the node after a 20 millisecond cooldown. In a Jest test environment, the
 * process is not exited.
 */
function stop(callback) {
  callback = callback === undefined ? (error, result) => {} : callback;
  if (global.distribution.node.server === undefined) {
    callback(new Error("Node server is not active"), null);
    return;
  }

  if (!global.shuttingDown) {
    global.shuttingDown = true;
    if (global.distribution.local.heartbeat?._interval !== undefined) {
      clearInterval(global.distribution.local.heartbeat._interval);
    }
    setTimeout(() => {
      try {
        global.distribution.node.server.close(() => {
          if (process.env.JEST_WORKER_ID === undefined) {
            log("Shut down node");
            process.exit(0);
          }
        });
      } catch (error) {
        console.error(error);
        process.exit(1);
      }
    }, 20);
    log("Scheduled node shutdown");
  }

  callback(null, global.nodeConfig);
}

/**
 * Force stops the node after a 20 millisecond cooldown.
 */
function forceStop(callback) {
  callback = callback === undefined ? (error, result) => {} : callback;
  global.shuttingDown = true;
  if (global.distribution.local.heartbeat?._interval !== undefined) {
    clearInterval(global.distribution.local.heartbeat._interval);
  }

  setTimeout(() => {
    log("Force stopping node");
    if (global.distribution.node.server !== undefined) {
      global.distribution.node.server.close(() => {
        process.exit(0);
      });
    } else {
      process.exit(0);
    }
  }, 20);

  callback(null, global.nodeConfig);
}

module.exports = {get, spawn, stop, forceStop};
