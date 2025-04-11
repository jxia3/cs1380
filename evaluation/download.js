const fs = require("fs");

const name = process.argv[2];
if (!fs.existsSync(`data/${name}.json`)) {
  console.error("File does not exist");
  process.exit(1);
}
const data = JSON.parse(fs.readFileSync(`data/${name}.json`));

console.log(data)