const run = require("../run.js");
const distribution = run.distribution;

const fs = require("fs");

const OPTION = '5000-words'; // Choose 'frequentTerms' (data/frequent.json) or '5000-words' (data/5000-words.txt)
const NUM_QUERIES = 1000;
const PROGRESS_INTERVAL = NUM_QUERIES / 5;
const MISPELL_PROB = 0.1; // To make random queries more realistic

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

let termListData, termList, termListCount;
if (OPTION == 'frequentTerms') {
  // Option 1: Use the frequent terms for query
  // - upper bound, since frequent terms have the most results so they should take the longest to query
  if (!fs.existsSync(`data/frequent.json`)) {
    console.error("No frequent.json file in the data directory");
    process.exit(1);
  }
  termListData = fs.readFileSync(`data/frequent.json`);
  termList = JSON.parse(termListData);
  termList = termList.map(termData => termData['text']);
  termListCount = termList.length;
}
else if (OPTION == '5000-words') {
  // Option 2: Use 5000 words for query
  if (!fs.existsSync(`data/5000-words.txt`)) {
    console.error("No 5000-words.txt file in the data directory");
    process.exit(1);
  }
  termListData = fs.readFileSync(`data/5000-words.txt`, 'utf8');
  termList = termListData.split('\n');
  termListCount = termList.length;
} else {
  console.log(`Invalid OPTION value: must be frequentTerms or 5000-words`);
  process.exit(1);
}

// Generate queries (only single term queries for now)
const queries = [];
for (let i = 0; i < NUM_QUERIES; i++) {
  // Add a random frequent term
  const randomIndex = Math.floor(Math.random() * termListCount);
  let randomTerm = termList[randomIndex];

  // Randomly mispell
  if (Math.random() < MISPELL_PROB) {
    const randomLowerChar = String.fromCharCode(Math.floor(97 + Math.random() * 26));
    const randomCharIndex = Math.floor(Math.random() * randomTerm.length);
    randomTerm = randomTerm.slice(0, randomCharIndex) + randomLowerChar + randomTerm.slice(randomCharIndex + 1);
  }

  queries.push(randomTerm);
}

console.log(queries);

run.startGroup(nodeCount, () => {
  setTimeout(() => {
    const start = process.hrtime();
    // Send all the queries
    let remaining = NUM_QUERIES;
    for (const query of queries) {
      distribution.local.queryPerf.query(query, (error, result) => {
        remaining--;
        if (remaining % PROGRESS_INTERVAL == 0) {
          console.log(`Remaining: ${remaining}`);
        }
        if (remaining == 0) {
          const end = process.hrtime(start);
          const durationMs = (end[0] * 1000) + (end[1] / 1e6);
          fs.writeFileSync(`data/${name}.json`, JSON.stringify(durationMs, null, 4));
          console.log(`Total time ${durationMs} ms`);
        }
      });
    }
  }, 1000)
});