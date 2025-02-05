const local = require("./local.js");
const log = require("../util/log.js");
const util = require("../util/util.js");

const http = require("http");

/* Starts the node's HTTP server to begin handling messages. The callback function
   is called when the server is alive. */
function start(callback) {
  const server = http.createServer(handleRequest);

  server.listen(global.nodeConfig.port, global.nodeConfig.ip, () => {
    log(`Server running at http://${global.nodeConfig.ip}:${global.nodeConfig.port}`);
    global.distribution.node.server = server;
    if (typeof callback === "function") {
      callback(server);
    } else {
      log("Received a start callback that is not a function");
    }
  });

  server.on("error", (error) => {
    log(`Server error: ${error}`);
    throw error;
  });
}

/* Handles an incoming HTTP request. If the request is a message, then the corresponding
   service is called to process the message. */
function handleRequest(request, response) {
  // Check request type and URL
  if (request.method !== "PUT") {
    sendError(400, "Invalid request type", response);
  }
  const urlParts = request.url.slice(1).split("/");
  if (urlParts.length !== 2 || !(urlParts[0] in local)) {
    sendError(400, "Service not found", response);
  }
  if (!(urlParts[1] in local[urlParts[0]])) {
    sendError(400, "Service method not found", response);
  }

  // Read and parse request content
  let content = "";
  request.on("data", (chunk) => content += chunk);
  request.on("end", () => {
    try {
      const data = util.deserialize(content);
      dispatchService(urlParts[0], urlParts[1], data);
    } catch (error) {
      sendError(400, error.message, response);
    }
  });
}

/* Responds to an HTTP request with an error. */
function sendError(code, message, response) {
  response.writeHead(code, {"Content-Type": "application/json"});
  response.end(util.serialize(new Error(message)));
}

/* Calls a service method to handle a message. */
function dispatchService(service, method, data) {
  console.log("got message:", service, method, data);
}

module.exports = {
  start: start,
};
