const run = require("./run.js");
const distribution = run.distribution;

const fs = require("fs");

const name = process.argv[3];
if (name === "") {
  console.error("No name provided");
  process.exit(1);
}
if (name.includes("/") || name.endsWith(".json")) {
  console.error("Invalid file name");
  process.exit(1);
}
if (fs.existsSync(`data/${name}.json`)) {
  console.error("File with name already exists");
  process.exit(1);
}

