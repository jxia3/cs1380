const distribution = require("./distribution.js");

setTimeout(() => {
  const terms = distribution.util.search.calcTerms("google ai model")
  console.log(terms)
}, 1000)