const distribution = require("./distribution.js");

const GROUP = distribution.searchParams.searchGroup;

const localNode = {
  ip: distribution.node.config.ip,
  port: distribution.node.config.port,
};
const nodes = [localNode];
const query = "google ai model";

distribution.node.start(() => {
  global.distribution.util.search.downloadPage("https://cds.nyu.edu/masters-financial-aid", (error, data) => {
    console.log(data);
    const a = global.distribution.local.index.extractText(data);
    console.log(a);
    console.log(typeof(a));
    console.log(a.length);

  })
  // distribution.local.groups.put(GROUP, nodes, (error, result) => {
  //   if (error) {
  //     throw error;
  //   }
  //   distribution[GROUP].groups.put(GROUP, nodes, (error, result) => {
  //     if (Object.keys(error).length > 0) {
  //       throw error;
  //     }
  //     setTimeout(() => {
  //       const terms = distribution.util.search.calcTerms(query).terms;
  //       distribution[GROUP].termLookup.lookup(terms, console.log);
  //     }, 100);
  //   });
  // });
});
