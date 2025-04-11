const distribution = require("./distribution.js");

const GROUP = distribution.searchParams.searchGroup;

const localNode = {
  ip: distribution.node.config.ip,
  port: distribution.node.config.port,
};
const nodes = [localNode];
const query = "google ai model";

// console.log(distribution.util.deserialize('{"t":"o","v":{"[pass]-full":{"t":"o","v":{"https://www.nba.com/schedule":{"t":"o","v":{"score":"n_0.0055248618784530384","context":{"t":"a","v":[{"t":"o","v":{"text":"s_Broadcasters National Broadcasters LEAGUE PASS Hide Previous Dates","start":"n_1206","end":"n_1273"}}]},"term":"s_pass"}}}},"[kessler uta]-full":{"t":"o","v":{"https://www.nba.com/stats":{"t":"o","v":{"score":"n_0.0017985611510791368","context":{"t":"a","v":[{"t":"o","v":{"text":"s_Lopez MIL 139 Walker Kessler UTA 138 Dyson Daniels ATL","start":"n_4198","end":"n_4254"}}]},"term":"s_kessler uta"}},"https://www.nba.com/stats/players":{"t":"o","v":{"score":"n_0.006910167818361303","context":{"t":"a","v":[{"t":"o","v":{"text":"s_LAC 12.5 5. Walker Kessler UTA 12.2 1. Trae Young","start":"n_539","end":"n_590"}},{"t":"o","v":{"text":"s_LAC 8.6 1. Walker Kessler UTA 2.4 2. Myles Turner","start":"n_694","end":"n_745"}},{"t":"o","v":{"text":"s_Edey MEM 15.5 Walker Kessler UTA 14.5 Donovan Clingan POR","start":"n_1739","end":"n_1798"}}]},"term":"s_kessler uta"}}}}}}'))

distribution.node.start(() => {
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
  distribution.local.groups.put("search", [distribution.node.config], () => {
    // distribution.local.crawl._start(RESET, () => {
    //   distribution.local.index._start(RESET, () => {
    //     setTimeout(() => {
    //       distribution.local.crawl.queueURLs(["https://www.nba.com/"], () => {});
    //     }, 1000);
    //   });
    // });
    setTimeout(() => {
      distribution.local.query.dihQuery('epic bsdlkfsdf', () => {});
    }, 1000);
  });
});
