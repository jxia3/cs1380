#!/usr/bin/env node

const log = require("./distribution/util/log.js");
const params = require("./distribution/params.js");
const util = require("./distribution/util/util.js");

const args = require("yargs").argv;

const DEPLOYMENT = params.deployment;

// Default configuration
global.nodeConfig = global.nodeConfig || {
  ip: DEPLOYMENT ? "0.0.0.0" : "127.0.0.1",
  port: DEPLOYMENT ? 80 : 1234,
  heartbeat: false,
  onStart: () => {},
};
global.searchParams = params;

/*
  You can pass "ip" and "port" arguments directly.
  Use this to startup nodes from the terminal.

  Usage:
  ./distribution.js --ip '127.0.0.1' --port 1234 # Start node on localhost:1234
*/
if (args.ip) {
  global.nodeConfig.ip = args.ip;
}
if (args.port) {
  global.nodeConfig.port = parseInt(args.port);
}
if (args.heartbeat) {
  global.nodeConfig.heartbeat = true;
}

if (args.config) {
  const nodeConfig = util.deserialize(args.config);
  global.nodeConfig.ip = nodeConfig.ip ? nodeConfig.ip : global.nodeConfig.ip;
  global.nodeConfig.port = nodeConfig.port ? nodeConfig.port : global.nodeConfig.port;
  global.nodeConfig.heartbeat = nodeConfig.heartbeat ? true : false;
  global.nodeConfig.onStart = nodeConfig.onStart ? nodeConfig.onStart : global.nodeConfig.onStart;
  if (nodeConfig._disableLogs) {
    try {
      log.disable();
    } catch (error) {
      console.error(error);
    }
  }
}

const distribution = function(config) {
  if (config) {
    global.nodeConfig = config;
    this.nodeConfig = config;
  }
  return global.distribution;
};

// Don't overwrite the distribution object if it already exists
if (global.distribution === undefined) {
  global.distribution = distribution;
}

distribution.util = require("./distribution/util/util.js");
distribution.local = require("./distribution/local/local.js");
distribution.node = require("./distribution/local/node.js");
distribution.searchParams = params;
distribution.disableLogs = log.disable;

for (const key in distribution.local) {
  distribution.local.routes.put(distribution.local[key], key);
}

// Initialize distribution object
distribution["all"] = {_isGroup: true};
distribution["all"].comm = require("./distribution/all/comm")({gid: "all"});
distribution["all"].gossip = require("./distribution/all/gossip")({gid: "all"});
distribution["all"].groups = require("./distribution/all/groups")({gid: "all"});
distribution["all"].mem = require("./distribution/all/mem")({gid: "all"});
distribution["all"].routes = require("./distribution/all/routes")({gid: "all"});
distribution["all"].status = require("./distribution/all/status")({gid: "all"});
distribution["all"].store = require("./distribution/all/store")({gid: "all"});

distribution.node.config = global.nodeConfig;
module.exports = distribution;

// The following code is run when distribution.js is run directly
if (require.main === module) {
  log(`[node] Starting node with configuration: ${JSON.stringify(global.nodeConfig)}`);
  distribution.node.start(global.nodeConfig.onStart);
}
