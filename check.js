const fs = require("fs")

const util = require("./distribution/util/util.js")
const shardedStore = require("./distribution/local/sharded-store.js")
global.distribution = { util }

const nodes = {}
const ips = [
  "3.148.206.79", "52.14.50.72", "3.147.45.181", "3.135.210.183", "3.148.226.105",
  "13.58.71.61", "18.116.14.107", "3.148.248.72", "3.128.172.56", "3.137.198.123",
]
for (let i = 0; i < ips.length; i += 1) {
    const node = { ip: ips[i], port: 80, index: i + 1 }
    const nodeId = util.id.getSID(node)
    nodes[nodeId] = node
}

// const terms = ["scare"]
// for (const term of terms) {
//   const node = util.id.applyHash(term, nodes, util.id.rendezvousHash);
//   console.log(nodes);
//   console.log("node with the term:", node);
//   console.log(nodes[node].index)
// }

const term = "lebron"
const [shard, path] = findShard(term)
console.log(shard, path)
for (let n = 1; n <= 2; n += 1) {
    const data = readShard(`nodes/store-${n}/9dd21/search/${btoa('shard-19999')}.dat`)
    console.log(Object.keys(data).length);
    if (term in data) {
        console.log(Object.keys(data[term]));
    }
}

function findShard(term) {
    const node = util.id.applyHash(term, nodes, util.id.rendezvousHash)
    const nodeIndex = nodes[node].index
    const shard = shardedStore._getShardKey(term)
    return [shard, `nodes/store-${nodeIndex}/9dd21/search/${btoa(shard)}.dat`]
}

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