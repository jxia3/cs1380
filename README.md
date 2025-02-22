# M4: Distributed Storage

## Summary

> Summarize your implementation, including key challenges you encountered

Remember to update the `report` section of the `package.json` file with the total number of hours it took you to complete each task of M4 (`hours`) and the lines of code per task.

## Correctness & Performance Characterization

> Describe how you characterized the correctness and performance of your implementation

*Correctness* -- I wrote 6 tests; these tests take a few seconds to execute. The tests cover:
- a
- b
- c
- d
- e
- Automatically reconfiguring objects when a new node is added to a group.

*Performance* -- insertion and retrieval.

## Key Feature

> Why is the `reconf` method designed to first identify all the keys to be relocated and then relocate individual objects instead of fetching all the objects immediately and then pushing them to their corresponding locations?

Reconfiguration can be an expensive operation. To be as efficient as possible, the operation should not retrieve the value of every object. Instead, because the hash function to decide where an object goes soley depends on the key, only all the keys need to be retrieved. Then, every key that is still assigned to the same node with the new group does not need to be moved or retrieved. Only the objects that need to be moved are retrieved and then stored in their new locations.

# M3: Node Groups & Gossip Protocols

## Summary

> Summarize your implementation, including key challenges you encountered. Remember to update the `report` section of the `package.json` file with the total number of hours it took you to complete each task of M3 (`hours`) and the lines of code per task.

My implementation comprises 3 new software components, totaling 600 added lines of code over the previous implementation. The primary component is a groups module that facilitates creating and sending messages to groups of remote nodes. I abstracted the message sending and group context creation logic into a `remote` module and implemented distributed communication with the remote send function provided by the module. Then, I packaged local services including `status` and `routes` into distributed services. Additionally, I implemented a lightweight gossip protocol that supports broadcasting messages across a group of nodes.

A key challenge was implementing the `status.spawn` function to spawn a new node. To support callbacks after a node has started up, I composed the provided start function for the new node with a local callback wrapped as an RPC. The composed function required text replacement since both the start function and the RPC stub need to be called from a single function, and the function cannot reference local data.

Another challenge was ensuring that the group context is bound to methods exposed by distributed services. Since all distributed services need to create functions bound to a context containing the group ID, I abstracted the logic into a `remote` module. The functions provided to create a bound context also insert safety checks including checking if a group exists before calling a remote method. My abstraction saved me from writing a significant amount of repetitive code.

## Correctness & Performance Characterization

> Describe how you characterized the correctness and performance of your implementation

*Correctness*: I wrote 5 tests; these tests take a few seconds to execute. The tests cover:
- Adding nodes to the all group when a new group is created.
- Adding groups to remote nodes with a distributed service.
- Spawning a node in a group with a distributed service.
- Adding a new service to all the nodes in a group.
- Sending a gossip message to all the nodes in a group.

*Performance* -- I measured the performance of spawning a node and characterized the convergence of gossip across a network. Locally, my spawn implementation achieved an average latency of 0.840 seconds per node with a throughput of 17.5 nodes per second: multiple spawn commands can run concurrently. On AWS, I observed a much higher average latency of 2.67 seconds per node and a lower throughput of 6.77 nodes per second because the instance has limited compute resources. Details on the test parameters can be found in the `performance` directory.

After spawning 100 nodes, I measured how many nodes received a gossip message with different broadcast parameters. If each node broadcasts a message to only one other node, only 16 nodes receive the message. As soon as each node broadcasts a message to two other nodes, gossip experiences exponential growth and 81 nodes recieve the message. The number of nodes that receive the message gradually increases as the broadcast parameter increases until all nodes receive the message at six messages per node. The detailed results are located in the `package.json` file.

## Key Feature

> What is the point of having a gossip protocol? Why doesn't a node just send the message to _all_ other nodes in its group?

A gossip protocol is a scalable and simple way to distribute a message across all the nodes in a network. Simply sending a message from each node to all other known nodes would quickly become unscalable: the total number of messages sent would grow quadratically with the size of the network. Thus, the communication load on each individual node would be unreasonable for large networks. A gossip protocol where each node communicates with random neighbors has a small, bounded communication cost per node and takes advantage of exponential scaling to distribute messages with high probability across the network.

# M2: Actors and Remote Procedure Calls (RPC)

## Summary

> Summarize your implementation, including key challenges you encountered. Remember to update the `report` section of the `package.json` file with the total number of hours it took you to complete each task of M2 (`hours`) and the lines of code per task.

My implementation comprises 5 software components, totaling 400 lines of code. First, I implemented the node HTTP server and the `status`, `routes`, and `rpc` components. In addition to the required functionality, I added an `rpc` service to support creating and calling local RPC functions. As an extension, it is possible for external nodes to request a host node to create an RPC function from a serialized message. Finally, I created a throughput and latency testing framework to measure the performance of communication tasks.

A key challenge was implementing communication with callbacks. The `local.comm` module needs to coordinate with the node HTTP server to send and receive messages with the correct format. Furthermore, errors in the number of arguments to service methods can be difficult to catch since variadic parameter lists are used frequently. To mitigate this issue, I added an additional safety check in the HTTP server to ensure that a callback is never set as undefined. Otherwise, requests could hang and become hard to debug.

After implementing communication, I created an RPC service to support the `wire.createRPC` method. The local method simply calls the service to register a local function as an RPC function. A key challenge was ensuring that a stub could be properly serialized and transferred to a remote node. I used text replacement to populate the remote node fields with the current node's configuration and also the ID of the RPC function.

## Correctness & Performance Characterization

> Describe how you characterized the correctness and performance of your implementation

*Correctness*: I wrote 5 tests; these tests take less than a second to execute. The tests cover:
- Incrementing the global message count when a message is received.
- Adding and removing a service in the routes registry.
- Overwriting a default service and restoring a default service.
- Creating a stateful RPC function.
- Creating an RPC function that communicates with other nodes.

*Performance*: I characterized the performance of comm and RPC by sending 1000 service requests in a tight loop. Average throughput and latency is recorded in `package.json`. My communication module achieved a throughput of 2.26 requests per millisecond and a latency of 0.441 milliseconds per request in my local environment. My RPC module achieved a similar throughput, which is reasonable because an RPC stub calls the communication module. On AWS, I observed worse performance at a throughput of 1.02 requests per millisecond and a latency of 0.979 milliseconds per request for my communication module, possibly because the AWS instance has less compute power than my local machine. Further details about the test can be found in the `performance` directory.

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