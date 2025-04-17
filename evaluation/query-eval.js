const run = require("../run.js");
const params = require("../distribution/params.js");
const distribution = run.distribution;
const GROUP = run.GROUP;

const fs = require("fs");
const {performance} = require("perf_hooks");

const OPTION = '5000words'; // Choose 'frequentTerms' (data/frequent.json) or '5000words' (data/5000-words.txt)
const BIG = true; // Whether to use larger term-list files
const MISPELL_PROB = 0.1; // To make random queries more realistic

const WRITE_TO_FILE = false;
const SKEW = 5; // Skewed randomness when selecting terms
const NUM_QUERIES = params.queryPerfQueries;
const PROGRESS_INTERVAL = NUM_QUERIES / 5;

const nodeCount = +process.argv[2];
if (isNaN(nodeCount) || nodeCount <= 0 || Math.floor(nodeCount) !== nodeCount) {
  console.error("Invalid node count");
  process.exit(1);
}

let name;
if (WRITE_TO_FILE) {
  name = process.argv[3];
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
}

/*
// let termListData, termList, termListCount;
// if (OPTION == 'frequentTerms') {
//   // Option 1: Use the frequent terms for query
//   // - upper bound, since frequent terms have the most results so they should take the longest to query
//   if (!fs.existsSync(`data/frequent.json`)) {
//     console.error("No frequent.json file in the data directory");
//     process.exit(1);
//   }
//   termListData = fs.readFileSync(`data/frequent.json`);
//   termList = JSON.parse(termListData);
//   termList = termList.map(termData => termData['text']);
//   termListCount = termList.length;
// }
// else if (OPTION == '5000words') {
//   // Option 2: Use 5000 words for query
//   if (!fs.existsSync(`data/5000-words.txt`)) {
//     console.error("No 5000-words.txt file in the data directory");
//     process.exit(1);
//   }
//   termListData = fs.readFileSync(`data/5000-words.txt`, 'utf8');
//   termList = termListData.split('\n');
//   termListCount = termList.length;
// } else {
//   console.log(`Invalid OPTION value: must be frequentTerms or 5000-words`);
//   process.exit(1);
// } 
*/

/* GENERATE TERM LIST */
let termList = [];
// To have some repeats, we want (NUM_QUERIES / 5) terms in the termList
const TERMS_IN_LIST = NUM_QUERIES / 5;
for (let i = 1; i <= nodeCount; i++) {
  // const filePath = BIG ? `data/stored-terms/store-${i}-terms-big.json` : `data/stored-terms/store-${i}-terms.json`
  const filePath = `data/stored-terms/store-${i}-terms-big.json`;
  const termsForNode = fs.readFileSync(filePath);
  const termsParsed = JSON.parse(termsForNode);
  const termsToAdd = termsParsed.slice(0, (TERMS_IN_LIST / nodeCount));

  termList = termList.concat(termsToAdd);
}
termListCount = termList.length;
console.log(`Testing with ${termListCount} unique terms in the term list`);
console.log(`Will generate ${NUM_QUERIES} query terms using terms from this list`);

/* SHUFFLE TERMLIST */
function shuffle(array) {
  let currentIndex = array.length;

  // While there remain elements to shuffle...
  while (currentIndex != 0) {

    // Pick a remaining element...
    let randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;

    // And swap it with the current element.
    [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
  }
}

shuffle(termList);

// Generate queries
const queries = [];
// Get 10 terms, for each fill with 1500 of that term
const fill = 10;
const amt = 1500;
for (let i = 0; i < fill; i++) {
  const randomIndex = Math.floor(Math.random() * termListCount);
  const randomTerm = termList[randomIndex];
  for (let _ = 0; _ < amt; _++) {
    queries.push(randomTerm);
  }
}
// Fill the rest of the terms semi-randomly
for (let i = 0; i < NUM_QUERIES - (fill * amt); i++) {
  // Add a random frequent term
  const randomIndex = Math.floor(Math.pow(Math.random(), SKEW) * termListCount);
  let randomTerm = termList[randomIndex];

  queries.push(randomTerm);
}

// Count frequencies using a Map for efficiency
const termFrequencies = new Map();
for (const term of queries) {
  termFrequencies.set(term, (termFrequencies.get(term) || 0) + 1);
}
console.log(`Number of unique terms actually present in generated list: ${termFrequencies.size}`);

// Display the top 20 most frequent terms
// Convert Map to array, sort by frequency (descending), take top 20
const sortedFrequencies = Array.from(termFrequencies.entries()).sort((a, b) => b[1] - a[1]);

console.log("\nTop 20 most frequent terms (Term: Count):");
for (let i = 0; i < Math.min(20, sortedFrequencies.length); i++) {
  console.log(`- ${sortedFrequencies[i][0]}: ${sortedFrequencies[i][1]}`);
}

let totalLatency = 0;
run.startGroup(nodeCount, () => {
  setTimeout(() => {
    const terms = queries.map(term => ({ text: term }));
    
    // Send all the queries at once, multiple times
    function lookupRecur(rem) {
      if (rem > 0) {
        distribution[GROUP].termLookup.lookup(terms, (error, result) => {
          shuffle(terms);
          lookupRecur(rem - 1);
        })
      }
    }

    lookupRecur(5);
  }, 1000);
});