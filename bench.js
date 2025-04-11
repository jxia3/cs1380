const run = require("./run.js");
const distribution = run.distribution;

const fs = require("fs");

const nodeCount = +process.argv[2];
if (isNaN(nodeCount) || nodeCount <= 0 || Math.floor(nodeCount) !== nodeCount) {
  console.error("Invalid node count");
  process.exit(1);
}

const name = process.argv[3];
if (name === undefined || name === "") {
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

const data = [];
run.download(nodeCount, true);
const interval = setInterval(() => {
  distribution.local.search.getCounts((error, counts) => {
    if (error) {
      console.error(error);
      return;
    }
    data.push({
      time: Date.now(),
      counts: {...counts},
    });
    fs.writeFileSync(`data/${name}.json`, JSON.stringify(data, null, 4));
    console.log(counts);
  });
}, 2000);

process.on("SIGINT", () => {
  clearInterval(interval);
});
