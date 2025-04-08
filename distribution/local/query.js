const util = require("../util/util.js");
const search = require("../util/search.js");
const params = require("../params.js");

const GROUP = params.searchGroup;
const MAX_SEARCH_RESULTS = 10;

// first take in the sentence
// then calc the terms (search.calcTerms)

/*
- make some sort of all call (similar to updateIndex) that takes in list of terms
- within this, use some calcBatches function to get an object with info about what
node each term is stored on
- then use a local.comm.send with some get function to get the file from the store 
in the correct node
- aggregate these results outside of all of these calls
- callback back into dihQuery should contain all the relevant information
*/

function dihQuery(query, callback) {
    callback = callback === undefined ? (error, result) => {} : callback;

    // console.log(search.calcTerms(query));

    const words = search.calcTerms(query).terms;

    // console.log('words: ', words);

    global.distribution[GROUP].query.superDih(words, (errors, results) => {
        // console.log('bruh: ', results);
        // console.log('errors: ', errors);
        const sortedUrls = Object.entries(results)
                        .sort((a, b) => b[1].score - a[1].score)
                        .map(([url, data]) => ({ url, ...data }));
        // console.log('sorted: ', sortedUrls);
        const topUrls = sortedUrls.slice(0, MAX_SEARCH_RESULTS);
        const numUrls = topUrls.length;

        if (numUrls > 0) {
            // console.log(`Dihsplaying top ${numUrls} result(s) for query "${query}":`);
            console.log(`\n👑 Yes, king! Your royal search for "${query}" has delivered 👑`);
            console.log(`💅💅💅 Here are your top ${numUrls} result(s): 😋😋😋\n`);
            for (const url of topUrls) {
                console.log("URL:      " + url.url);
                console.log("Score:    " + url.score);
                console.log("Title:    " + url.title);
                console.log("Context:  " + url.context);
                console.log("—".repeat(40)); // separator line
            }
        } else {
            console.log(`😔 No search results found for query "${query}".`);
        }
        
        // console.log('urls: ', sortedUrls);
        // callback(errors, sortedUrls)
    });
}


module.exports = {dihQuery};