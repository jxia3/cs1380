const fs = require("fs")

const util = require("./distribution/util/util.js")
const params = require("./distribution/params.js");
global.distribution = { util }

const SHARDS_TO_READ = 200; // hard code for now
const SHARD_STRIDE = params.shardCount / SHARDS_TO_READ;

// Read terms from different shards on the local store and save it to a json file
let terms = [];
for (let i = 0; i < SHARDS_TO_READ; i++) {
  if (i % (SHARDS_TO_READ / 5) == 0) {
    console.log('Completed:', i);
  }
  const data = readShard(`nodes/store-1/9dd21/search/${btoa(`shard-${i * SHARD_STRIDE}`)}.dat`);
  terms = terms.concat(Object.keys(data));
}
fs.writeFileSync(`term-list.json`, JSON.stringify(terms, null, 4));

function readShard(path) {
    const data = fs.readFileSync(path).toString()
    try {
        return util.deserialize(data)
    } catch(error) {
        console.log("Error deserializing", path)
        console.error(error)
        return {}
    }
}