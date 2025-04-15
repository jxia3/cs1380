const fs = require("fs")

const util = require("./distribution/util/util.js")
const shardedStore = require("./distribution/local/sharded-store.js")
global.distribution = { util }

const nodes = {}
const ips = [
    "3.139.81.183", "3.149.2.194", "18.217.66.8", "3.15.220.99", "3.147.63.105",
    "18.226.159.174", "18.117.185.42", "18.223.196.60", "3.139.108.222", "3.16.66.233",
]
for (let i = 0; i < ips.length; i += 1) {
    const node = { ip: ips[i], port: 80, index: i + 1 }
    const nodeId = util.id.getSID(node)
    nodes[nodeId] = node
}

const term = "lebron"
const [shard, path] = findShard(term)
console.log(shard, path)
for (let n = 1; n <= 10; n += 1) {
    const data = readShard(`nodes/store-${n}/9dd21/search/${btoa(shard)}.dat`)
    console.log(n, term in data)
    if (term in data) {
        console.log(Object.keys(data[term]))
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