const fs = require("fs");
const path = require("path");

/* Logs messages to the console and a log file. */

let PRINT_MESSAGES = true;
let SAVE_MESSAGES = false;
const LOG_FILE = "log.txt";

const logFile = path.join(__dirname, "../../", LOG_FILE);

/* Appends timestamp and node information to a message and logs the message. */
function log(message, severity) {
  if (severity === undefined) {
    severity = "info";
  }
  const now = new Date();
  const date = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(now);
  const timestamp = `${date}.${(now.getMilliseconds() * 1000).toString().padStart(6, "0")}`;

  global.distribution.local.status.get("sid", (error, sid) => {
    if (error) {
      throw error;
    }
    if (sid === undefined) {
      sid = "unknown";
    }
    const data = `[${timestamp}] [${global.nodeConfig.ip}:${global.nodeConfig.port} (${sid})] [${severity}] ${message}`;
    if (PRINT_MESSAGES) {
      console.log(data);
    }
    if (SAVE_MESSAGES) {
      fs.appendFileSync(logFile, data + "\n");
    }
  });
}

module.exports = log;
log.disable = () => {
  PRINT_MESSAGES = false;
  SAVE_MESSAGES = false;
};
