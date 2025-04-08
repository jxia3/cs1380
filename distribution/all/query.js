const util = require("../util/util.js");
const remote = require("./remote-service.js");

const NUM_DOCUMENTS = 1000;

/**
 * Distributes update index requests across the node group.
 */
function superDih(terms, callback) {
  checkContext(this.gid, this.hash);
  callback = callback === undefined ? (error, result) => {} : callback;
  global.distribution.local.groups.get(this.gid, (error, group) => {
    if (error) {
      callback(error, null);
      return;
    }
    const batches = calcBatches.call(this, group, terms);
    ultraDih(group, batches, callback);
  });
}

/**
 * Splits a set of terms into batches for each node.
 */
function calcBatches(group, terms) {
  const batches = {};
  for (const term of terms) {
    const node = util.id.applyHash(term, group, this.hash);
    if (!(node in batches)) {
      batches[node] = [];
    }
    batches[node].push(term);
  }
  // console.log('bathces: ', batches);
  return batches;
}

/**
 * Sends batches of index updates across a node group. The callback must be valid.
 */
function ultraDih(group, batches, callback) {
    const errors = {};
    const urls = {};
    // let active = Object.keys(batches).length;
    let dih = 0;
  
    for (const node in batches) {
      for (const term of batches[node]) {
        // console.log('term: ', term);
        const key = `[${term.text}]-full`;
        // console.log('key:', key);
        const remote = {node: group[node], service: "shardedStore", method: "get"};
        dih++;

        global.distribution.local.comm.send([key], remote, (error, result) => {
          // console.log('result: ', result);
          if (error) {
            errors[node] = error;
          }
          else {
            const numUrls = Object.keys(result).length;
            const idf = Math.log(NUM_DOCUMENTS / numUrls);
            for (const url in result) {
              if (!(url in urls)) {
                urls[url] = {score: 0, title: "", context: []};
              }
              urls[url].score += result[url].score * idf;
              // console.log('wtf:', result[url].context);

              // UPDATE THIS LATER
              if (typeof result[url].context[0] == 'object') {
                urls[url].context.push(result[url].context[0].text);
              } else {
                urls[url].context.push(result[url].context[0])
              }

              // urls[url].context.push(result[url].context[0].text);
              // console.log('hello: ', result[url].title);
              urls[url].title = result[url].title;

              // console.log('urls: ', urls);
            }
          }
          dih--;
          if (dih == 0) {
            callback(errors, urls);
          }  
        });
      }
    }
    if (dih == 0) {
      callback(errors, urls);
    }
  }

/**
 * Checks if the current function context is valid.
 */
function checkContext(groupId, hashFn) {
  remote.checkGroup(groupId);
  if (typeof hashFn !== "function") {
    throw new Error("Invalid index hash function");
  }
}

module.exports = (config) => {
  const context = {};
  context.gid = config?.gid === undefined ? "all" : config.gid;
  context.hash = config?.hash;
  if (typeof context.hash !== "function") {
    context.hash = util.id.rendezvousHash;
  }
  return {superDih: superDih.bind(context)};
};
