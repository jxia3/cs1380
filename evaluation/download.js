const fs = require("fs");

const WINDOW = 30;
const COUNT = 2000;

const name = process.argv[2];
if (!fs.existsSync(`data/${name}.json`)) {
  console.error("File does not exist");
  process.exit(1);
}
const data = JSON.parse(fs.readFileSync(`data/${name}.json`));

const crawlThroughput = [];
const indexThroughput = [];
for (let t = WINDOW; t < data.length; t += 1) {
  const duration = data[t].time - data[t - WINDOW].time;
  const crawled = data[t].counts.crawled - data[t - WINDOW].counts.crawled;
  const indexed = data[t].counts.indexed - data[t - WINDOW].counts.indexed;
  crawlThroughput.push({
    time: data[t].time - data[0].time,
    throughput: crawled / duration,
  });
  indexThroughput.push({
    time: data[t].time - data[0].time,
    throughput: indexed / duration,
  });
}

if (false) {
  console.log(crawlThroughput.filter((v, i) => i % 10 === 0));
  console.log(indexThroughput.filter((v, i) => i % 10 === 0));
}

const start = data[0];
const end = data.find((d) => d.counts.indexed >= COUNT);
console.log("Crawl throughput:", (end.counts.crawled - start.counts.crawled) * 1000 / (end.time - start.time));
console.log("Index throughput:", (end.counts.indexed - start.counts.indexed) * 1000 / (end.time - start.time));
