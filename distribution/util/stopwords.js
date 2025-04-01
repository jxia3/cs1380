/* A module that loads stopwords from a file. */

const fs = require("fs");
const path = require("path");

const stopwords = [];
fs.readFile(path.join(__dirname, "stopwords.txt"), (error, data) => {
  const words = data.toString().trim().split(/\s+/g);
  for (const word of words) {
    stopwords.push(word);
  }
});

module.exports = stopwords;
