const run = require("./run.js");
const distribution = run.distribution;

const GROUP = run.GROUP;

run.startLocal(() => {
  distribution[GROUP].store.get(null, (error, keys) => {
    if (Object.keys(error).length > 0) {
      throw error;
    }
    console.log("Got keys:", keys.length);
    const operation = {
      map: (terms) => {
        console.log(terms);
        return terms;
      },
      reduce: (key, values) => {
        console.log(key, values);
      },
    };
    distribution[GROUP].mr.exec(operation, (error, result) => {
      console.log(error, result);
    });
  });
});
