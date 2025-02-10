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
    if (callback !== undefined) {
      callback(server);
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
  // Check node status and request format
  if (global.shuttingDown) {
    sendError(500, new Error("Node shutting down"), response);
    return;
  }
  if (request.method !== "PUT") {
    sendError(400, new Error("Invalid request type"), response);
    return;
  }
  const urlParts = request.url.slice(1).split("/");
  if (urlParts.length !== 2) {
    sendError(400, new Error("Invalid URL path format"), response);
    return;
  }

  // Find node service
  local.routes.get(urlParts[0], (error, service) => {
    if (error) {
      sendError(400, error, response);
      return;
    }
    if (!(urlParts[1] in service)) {
      sendError(400, new Error(`Method '${urlParts[1]}' not in service`), response);
      return;
    }
    const method = service[urlParts[1]];

    let content = "";
    request.on("data", (chunk) => content += chunk);
    request.on("end", () => {
      // Deserialize request data
      let data;
      try {
        data = util.deserialize(content);
      } catch (error) {
        sendError(400, new Error("Unable to deserialize request body"), response);
        return;
      }
      if (!(data instanceof Array)) {
        sendError(400, new Error("Request body is not an argument list"), response);
        return;
      }
      if (data.length < method.length - 1) {
        sendError(400, new Error(`Expected ${method.length - 1} method arguments`), response);
        return;
      }

      // Call service and send result
      global.statusState.messageCount += 1;
      log(`Handling request to service '${urlParts[0]}'`);
      try {
        method(...data, (error, result) => {
          response.writeHead(200, {"Content-Type": "application/json"});
          response.end(util.serialize({error, result}));
        });
      } catch (error) {
        sendError(500, error, response);
      }
    });
  });
}

/* Responds to an HTTP request with an error. */
function sendError(code, error, response) {
  response.writeHead(code, {"Content-Type": "application/json"});
  response.end(util.serialize({error, result: null}));
}

module.exports = {
  start: start,
};
