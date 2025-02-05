/* Create log file */
const fs = require("fs");
const path = require("path");

const PRINT_MESSAGES = true;
const SAVE_MESSAGES = false;

const logFile = path.join(__dirname, "../../", "log.txt");

function log(message, severity) {
  if (severity === undefined) {
    severity = "info";
  }

  const now = new Date();
  const date = `${new Intl.DateTimeFormat("en-GB",
      {day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit",
        minute: "2-digit", second: "2-digit", hour12: false})
      .format(now)}.${String(now.getMilliseconds() * 1000).padStart(6, "0")}`;

  global.distribution.local.status.get("sid", (e, sid) => {
    if (sid === undefined) {
      sid = "unknown";
    }
    const data = `${date} [${global.nodeConfig.ip}:${global.nodeConfig.port} (${sid})] [${severity}] ${message}`;
    if (PRINT_MESSAGES) {
      console.log(data);
    }
    if (SAVE_MESSAGES) {
      fs.appendFileSync(logFile, data + "\n");
    }
  });
}

module.exports = log;
