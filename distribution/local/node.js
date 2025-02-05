const http = require("http");
const log = require("../util/log.js");

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
  console.log("got request", request);
  response.writeHead(200);
  response.write("hello");
  response.end();
}

module.exports = {
  start: start,
};
