/* A module with operations for a search engine. */

const http = require("http");
const https = require("https");

const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36";
const REQUEST_TIMEOUT = 20000;

/**
 * Downloads the HTML content of a page at a URL.
 */
function downloadPage(url, callback) {
  if (callback === undefined) {
    throw new Error("No callback provided");
  }
  callback = global.distribution.util.sync.createGuardedCallback(callback);

  const module = url.startsWith("https") ? https : http;
  const request = module.request(url, {
    method: "GET",
    headers: {
      "User-Agent": USER_AGENT,
    },
    timeout: REQUEST_TIMEOUT,
  }, (response) => handleResponse(response, callback));

  request.on("timeout", () => {
    request.destroy(new Error("Request timed out"));
  });

  request.on("error", (error) => {
    callback(error, null);
  });

  request.end();
}

/**
 * Saves the HTML content from an HTTP response.
 */
function handleResponse(response, callback) {
  let content = "";
  response.on("data", (chunk) => content += chunk);
  response.on("end", () => callback(null, content));
}

module.exports = {downloadPage};
