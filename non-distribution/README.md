todo: end to end test

# M0: Setup & Centralized Computing

> Add your contact information below and in `package.json`.
* name: `Jerry Xia`
* email: `jerry_xia1@brown.edu`
* cslogin: `jxia31`

## Summary

> Summarize your implementation, including the most challenging aspects; remember to update the `report` section of the `package.json` file with the total number of hours it took you to complete M0 (`hours`), the total number of JavaScript lines you added, including tests (`jsloc`), the total number of shell lines you added, including for deployment and testing (`sloc`).

My implementation consists of 10 components addressing T1--8: 8 JS/shell components for the core code, 1 student correctness testing component, and 1 performance testing component. I implemented both shell scripts and JS scripts for the core functionality in the `c` directory. For student testing, I developed 11 custom test cases. For performance testing, I developed two scripts: one to measure the crawler and indexer in the engine and one to measure the query handler.

The most challenging aspect was writing the correctness and performance testing scripts because it took me some time to understand how the provided shell scripts worked. I had not looked at bash commands in a while, and I needed to familiarize myself with the many commands used to process text. Additionally, running the scripts was often slow because I used a Docker container in WSL, which limits I/O speed.

## Correctness & Performance Characterization

> Describe how you characterized the correctness and performance of your implementation.

To characterize correctness, I developed 11 tests that test the following cases:
- `s_test_getURLs.sh`: an HTML page with a large number of links.
- `s_test_getText.sh`: an HTML page with a significant amount of body text.
- `s_test_process.sh`: page content with a significant amount of body text and unique words.
- `s_test_process_2.sh`: page content with only stop words.
- `s_test_stem.sh`: various word endings including ing, able, and ery.
- `s_test_combine.sh`: ngrams formed by page content with many unique words.
- `s_test_combine_2.sh`: ngrams formed by page content with only two words (no 3-grams).
- `s_test_invert.sh`: page content with many duplicate words.
- `s_test_invert_2.sh`: page content with non-English words.
- `s_test_merge.sh`: terms with a large number of links and occurrences.
- `s_test_query.sh`: multiple search terms including stopwords in a global index.

I added the additional tests for combine, invert, and process for my JS implementations. All of my tests pass locally and on my AWS EC2 t2.micro instance.

*Performance*: The throughput of various subsystems is described in the `"throughput"` portion of package.json. The characteristics of my development machines are summarized in the `"dev"` portion of package.json.

I measured the performance of my search engine on the first sandbox (https://cs.brown.edu/courses/csci1380/sandbox/1). Since the engine was prohibitively slow on my local machine, I was unable to run larger scale tests. Because I was running Docker in WSL, the I/O speed of my system was likely reduced and thus the performance I observed was lower than desired. In fact, I ran some of the JS scripts directly on Windows and observed better performance. In my local Docker container, my crawler and indexer took 11.68 seconds and 88.84 seconds respectively to process 10 pages, throughputs of 0.856 and 0.113. My query handler took 231.088 seconds to process 26 queries, a throughput of 0.113.

On my AWS EC2 t2.micro instance, I observed significantly better performance without the I/O overhead. My crawler and indexer took 1.850 and 6.885 seconds respectively to process 10 pages, throughputs of 5.405 and 1.452. My query handler took 12.916 seconds to process 26 queries, a throughput of 2.013.

My performance testing scripts are located in the `t/p` directory.

## Wild Guess

> How many lines of code do you think it will take to build the fully distributed, scalable version of your search engine? Add that number to the `"dloc"` portion of package.json, and justify your answer below.

I think completing the fully distributed search engine will require writing around 10,000 lines of code. Since most parts need to be implemented from scratch, it seems reasonable that the distributed version will need significanly more effort to implement than the current centralized version. Furthermore, utility libraries including serialization and deserialization will add to the amount of code required. There are 6 milestones, and at an estimate of 1,500 lines per milestone, I think that I will write 10,000 lines of code throughout the semester.

# non-distribution

This milestone aims (among others) to refresh (and confirm) everyone's
background on developing systems in the languages and libraries used in this
course.

By the end of this assignment you will be familiar with the basics of
JavaScript, shell scripting, stream processing, Docker containers, deployment
to AWS, and performance characterization—all of which will be useful for the
rest of the project.

Your task is to implement a simple search engine that crawls a set of web
pages, indexes them, and allows users to query the index. All the components
will run on a single machine.

## Getting Started

To get started with this milestone, run `npm install` inside this folder. To
execute the (initially unimplemented) crawler run `./engine.sh`. Use
`./query.js` to query the produced index. To run tests, do `npm run test`.
Initially, these will fail.

### Overview

The code inside `non-distribution` is organized as follows:

```
.
├── c            # The components of your search engine
├── d            # Data files like the index and the crawled pages
├── s            # Utility scripts for linting and submitting your solutions
├── t            # Tests for your search engine
├── README.md    # This file
├── crawl.sh     # The crawler
├── index.sh     # The indexer
├── engine.sh    # The orchestrator script that runs the crawler and the indexer
├── package.json # The npm package file that holds information like JavaScript dependencies
└── query.js     # The script you can use to query the produced global index
```

### Submitting

To submit your solution, run `./s/submit.sh`. This will create a
`submission.zip` file which you can upload to the autograder.
