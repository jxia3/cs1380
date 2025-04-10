const run = require("./run.js");
const distribution = run.distribution;

const GROUP = run.GROUP;

run.startLocal(() => {
  distribution[GROUP].mr.exec({

  });
});
