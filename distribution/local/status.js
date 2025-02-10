/* Tracks the current state of the node. Note that the node ID is computed once
   on startup, and subsequent changes to the node configuration are not reflected.*/

const id = require("../util/id.js");
const log = require("../util/log.js");
const util = require("../util/util.js");

const childProcess = require("child_process");
const path = require("path");

const state = {
  nid: id.getNID(global.nodeConfig),
  sid: id.getSID(global.nodeConfig),
  messageCount: 0,
};
global.statusState = state;

/* Retrieves a status value on the current node. */
function get(config, callback) {
  if (callback === undefined) {
    return;
  }
  if (config === "nid") {
    callback(null, state.nid);
  } else if (config === "sid") {
    callback(null, state.sid);
  } else if (config === "ip") {
    callback(null, global.nodeConfig.ip);
  } else if (config === "port") {
    callback(null, global.nodeConfig.port);
  } else if (config === "counts") {
    callback(null, state.messageCount);
  } else if (config === "heapTotal") {
    callback(null, process.memoryUsage().heapTotal);
  } else if (config === "heapUsed") {
    callback(null, process.memoryUsage().heapUsed);
  } else {
    callback(new Error(`Status '${config}' not found`), null);
  }
}

/* Creates a new node in a child process with a configuration. */
function spawn(config, callback) {
  config.onStart = createStartFn(config.onStart, callback);
  const file = path.join(__dirname, "../../distribution.js");
  childProcess.spawn("node", [file, "--config", util.serialize(config)], {
    detached: true,
    stdio: "inherit",
  });
}

/* Creates a start hook that calls a locally registered RPC function. */
function createStartFn(onStart, callback) {
  if (callback === undefined) {
    return;
  }
  const nodeStart = onStart === undefined ? () => {} : onStart;
  const externalStart = util.wire.createRPC(callback);

  function startFn(server) {
    const nodeStart = "__NODE_START__";
    const externalStart = "__EXTERNAL_START__";
    try {
      nodeStart(server);
    } catch {}
    try {
      externalStart(null, global.nodeConfig, (error, result) => {});
    } catch (error) {
      externalStart(error, null, (error, result) => {});
    }
  }
  const startText = startFn.toString()
      .replaceAll("\"__NODE_START__\"", nodeStart.toString())
      .replaceAll("\"__EXTERNAL_START__\"", externalStart.toString());

  return (new Function(`return ${startText}`))();
}

/* Stops the node after a 100 millisecond cooldown. */
function stop(callback) {
  if (global.distribution.node.server === undefined) {
    callback(new Error("Node server is not active"), null);
    return;
  }
  if (!global.shuttingDown) {
    global.shuttingDown = true;
    setTimeout(() => {
      try {
        global.distribution.node.server.close(() => {
          log("Shut down node");
          process.exit(0);
        });
      } catch {
        process.exit(1);
      }
    }, 100);
    log("Scheduled node shutdown");
  }
  callback(null, global.nodeConfig);
}

module.exports = {get, spawn, stop};
