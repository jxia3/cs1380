# M2: Actors and Remote Procedure Calls (RPC)

## Summary

> Summarize your implementation, including key challenges you encountered. Remember to update the `report` section of the `package.json` file with the total number of hours it took you to complete each task of M2 (`hours`) and the lines of code per task.

My implementation comprises `<number>` software components, totaling `<number>` lines of code. Key challenges included `<1, 2, 3 + how you solved them>`.

## Correctness & Performance Characterization

> Describe how you characterized the correctness and performance of your implementation

*Correctness*: I wrote `<number>` tests; these tests take `<time>` to execute.

*Performance*: I characterized the performance of comm and RPC by sending 1000 service requests in a tight loop. Average throughput and latency is recorded in `package.json`.

## Key Feature

> How would you explain the implementation of `createRPC` to someone who has no background in computer science — i.e., with the minimum jargon possible?

When you have internet services running across multiple machines, it might be useful to request to run a procedure on a different machine. The procedure may need access to data that is stored on a specific machine, or the procedure may be computationally expensive. The `createRPC` function packages a procedure so that other machines can request to run the procedure on the current machine. At a high level, `createRPC` creates a receipt that can be sent over the network, and anyone with the receipt can request the creator to run a procedure.

# M1: Serialization / Deserialization

## Summary

> Summarize your implementation, including key challenges you encountered. Remember to update the `report` section of the `package.json` file with the total number of hours it took you to complete each task of M1 (`hours`) and the lines of code per task.

My implementation comprises 3 software components, totaling 750 lines of code. I implemented a serialization and deserialization library that supports cyclic objects and dynamically discovers native functionality. Improving upon the provided implementation, I optimized my representation to reduce serialization overhead on small primitive objects including numbers, booleans, and strings. Furthermore, I benchmarked my implementation on synthetic workloads to confirm that my implementation achieves a lower latency than the provided library.

To improve efficiency, I decided to serialize primitive leaf types as strings instead of objects with metadata. As the first character, I added a type tag to identify the primitive type. For instance, the number `37` is serialized as `n_37` instead of an object with a type property. As such, my implementation reduces the overhead of serializing primitive types, which are the most common types.

One key challenge was serializing cyclic objects. While traversing the object graph with a depth-first search, I stored references in a map to avoid falling into cycles. Instead of generating a unique identifier for each node, I simply encoded references to objects as the path from the root to the owned object, or the first instance of the object encountered during the traversal. This design choice supports efficient deserialization since references can be directly resolved by traversing the path.

Another key challenge was discovering native functionality. Since the `process.binding` function is internal to Node.js, I could not find much documentation about it online. Furthermore, some modules exposed by the internal API are deprecated and need to be excluded from object discovery. I added all objects from both the global object and from internal modules to a lookup table that maps native functions to their unique access path.

## Correctness & Performance Characterization

> Describe how you characterized the correctness and performance of your implementation

*Correctness*: I wrote 5 tests; these tests take less than a second to execute. The tests cover:
- Each primitive type, including a floating point number and a string with special characters
- Date and Error types
- Named and anonymous functions
- An array containing objects
- An object containing arrays

Additionally, I tested my implementation for both performance and correctness on randomly generated objects in my performance tests. Deatils about how the objects are generated are located in the script in the `performance` directory.

*Performance*: The latency of various subsystems is described in the `"latency"` portion of package.json. The characteristics of my development machines are summarized in the `"dev"` portion of package.json.

I designed three workloads to benchmark my implementation:
1. Serializing and deserializing a list of 1,000,000 primtive values (numbers, booleans, etc.).
2. Serializing and deserializing a list of 100,000 relatively small and simple objects.
3. Serializing and deserializing a list of 1,000 large and complex objects.

On my local machine, my implementation achieved a serialization/deserialization latency of 0.220/0.155 microseconds per item on primitives, 2.72/4.95 microseconds per item on simple objects, and 605/1170 microseconds per item on complex objects. Since my local CPU is more powerful than the CPU on my AWS instance, I observed lower performance numbers when testing on EC2: 0.476/0.596 microseconds per item on primitives, 6.45/12.8 microseconds per item on simple objects, and 1340/3670 microseconds per item on complex objects. I also informally benchmarked the provided implementation and found that my version is roughly twice as fast.

My benchmarking script is located in the `performance` directory.

# M0: Setup & Centralized Computing

> Add your contact information below and in `package.json`.
* name: `Jerry Xia`
* email: `jerry_xia1@brown.edu`
* cslogin: `jxia31`

## Summary

> Summarize your implementation, including the most challenging aspects; remember to update the `report` section of the `package.json` file with the total number of hours it took you to complete M0 (`hours`), the total number of JavaScript lines you added, including tests (`jsloc`), the total number of shell lines you added, including for deployment and testing (`sloc`).

My implementation consists of 10 components addressing T1--8: 8 JS/shell components for the core code, 1 student correctness testing component, and 1 performance testing component. I implemented both shell scripts and JS scripts for the core functionality in the `c` directory. For student testing, I developed 11 custom test cases. For performance testing, I developed two scripts: one to measure the crawler and indexer in the engine and one to measure the query handler.

The most challenging aspect was writing the correctness and performance testing scripts because it took me some time to understand how the provided shell scripts worked. I had not looked at bash commands in a while, and I needed to familiarize myself with the many commands used to process text. Additionally, running the scripts was often slow because I used a Docker container in WSL, which limits I/O speed.

Furthermore, integrating TF-IDF with the existing pipeline was an additional challenge. Instead of changing the global index format, I created an auxiliary index file storing the data TF-IDF needs to compute document ranks. When called, the TF-IDF indexer updates the auxiliary index and generates a new global index. I further validated my implementation by adding an option to create a basic term frequency index from the TF-IDF index and checked that my new pipeline could pass all the basic tests.

## Correctness & Performance Characterization

> Describe how you characterized the correctness and performance of your implementation.

To characterize correctness for my basic implementation, I developed 11 tests that test the following cases:
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

I added the additional tests for combine, invert, and process for my JS implementations of the shell scripts. Furthermore, I tested my TF-IDF implementation on a custom document corpus generated by `s_test_index_tfidf.js`. Further details on TF-IDF testing are located in the script. All of my tests pass locally and on my AWS EC2 t2.micro instance.

*Performance*: The throughput of various subsystems is described in the `"throughput"` portion of package.json. The characteristics of my development machines are summarized in the `"dev"` portion of package.json.

I measured the performance of my search engine on the first sandbox (https://cs.brown.edu/courses/csci1380/sandbox/1). Since the engine was prohibitively slow on my local machine, I was unable to run larger scale tests. Because I was running Docker in WSL, the I/O speed of my system was likely reduced and thus the performance I observed was lower than desired. In fact, I ran some of the JS scripts directly on Windows and observed better performance. In my local Docker container, my crawler and indexer took 11.68 seconds and 88.84 seconds respectively to process 10 pages, throughputs of 0.856 pages per second and 0.113 pages per second. My query handler took 231.088 seconds to process 26 queries, a throughput of 0.113 queries per second.

On my AWS EC2 t2.micro instance, I observed significantly better performance without the I/O overhead. My crawler and indexer took 1.850 and 6.885 seconds respectively to process 10 pages, throughputs of 5.405 pages per second and 1.452 pages per second. My query handler took 12.916 seconds to process 26 queries, a throughput of 2.013 queries per second.

*TF-IDF Performance*: The throughput of the TF-IDF subsystems is also described in the `"throughput"` portion of package.json.

My TF-IDF crawler and query handler achieved roughly the same performance as their non-TF-IDF counterparts since none of their code changed. Locally, my TF-IDF indexer was slower than my basic indexer, taking 95.065 seconds to process 10 pages, which is a throughput of 0.105 pages per second. On AWS, my TF-IDF indexer achieved a throughput of 1.389 pages per second by processing 10 pages in 7.201 seconds. The extra work required to maintain a TF-IDF index traded off performance for search result quality, although the difference on AWS was negligible.

My performance testing scripts are located in the `non-distribution/t/p` directory.

## Wild Guess

> How many lines of code do you think it will take to build the fully distributed, scalable version of your search engine? Add that number to the `"dloc"` portion of package.json, and justify your answer below.

I think completing the fully distributed search engine will require writing around 12,000 lines of code. Since most parts need to be implemented from scratch, it seems reasonable that the distributed version will need significanly more effort to implement than the current centralized version. Furthermore, utility libraries including serialization and deserialization will add to the amount of code required. There are 6 milestones, and at an estimate of 2,000 lines per milestone, I think that I will write 12,000 lines of code throughout the semester.

# distribution

This is the distribution library. When loaded, distribution introduces functionality supporting the distributed execution of programs. To download it:

## Installation

```sh
$ npm i '@brown-ds/distribution'
```

This command downloads and installs the distribution library.

## Testing

There are several categories of tests:
  *	Regular Tests (`*.test.js`)
  *	Scenario Tests (`*.scenario.js`)
  *	Extra Credit Tests (`*.extra.test.js`)
  * Student Tests (`*.student.test.js`) - inside `test/test-student`

### Running Tests

By default, all regular tests are run. Use the options below to run different sets of tests:

1. Run all regular tests (default): `$ npm test` or `$ npm test -- -t`
2. Run scenario tests: `$ npm test -- -c` 
3. Run extra credit tests: `$ npm test -- -ec`
4. Run the `non-distribution` tests: `$ npm test -- -nd`
5. Combine options: `$ npm test -- -c -ec -nd -t`

## Usage

To import the library, be it in a JavaScript file or on the interactive console, run:

```js
let distribution = require("@brown-ds/distribution");
```

Now you have access to the full distribution library. You can start off by serializing some values. 

```js
let s = distribution.util.serialize(1); // '{"type":"number","value":"1"}'
let n = distribution.util.deserialize(s); // 1
```

You can inspect information about the current node (for example its `sid`) by running:

```js
distribution.local.status.get('sid', console.log); // 8cf1b
```

You can also store and retrieve values from the local memory:

```js
distribution.local.mem.put({name: 'nikos'}, 'key', console.log); // {name: 'nikos'}
distribution.local.mem.get('key', console.log); // {name: 'nikos'}
```

You can also spawn a new node:

```js
let node = { ip: '127.0.0.1', port: 8080 };
distribution.local.status.spawn(node, console.log);
```

Using the `distribution.all` set of services will allow you to act 
on the full set of nodes created as if they were a single one.

```js
distribution.all.status.get('sid', console.log); // { '8cf1b': '8cf1b', '8cf1c': '8cf1c' }
```

You can also send messages to other nodes:

```js
distribution.all.comm.send(['sid'], {node: node, service: 'status', method: 'get'}, console.log); // 8cf1c
```