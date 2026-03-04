# M6: Spark-Inspired Distributed Data Processing

## Overview

Extend the distributed execution engine (M5) with a richer set of data processing operations inspired by Apache Spark's RDD API. Your implementation should build on the existing MapReduce, store, and mem services. The goal is to provide Spark-like transformations and actions that run across a node group.

## Scope

Implement a set of transformations and actions that operate on distributed key-value data. You have freedom over:

- How to expose these operations (new service, extended `mr`, fluent API, etc.)
- Whether to support lazy evaluation or eager execution
- How to handle partitioning and shuffling
- The exact API shape (callbacks, config objects, method names)

### Substantial Requirements

To qualify as a substantial improvement over M5, your implementation must:

1. **Provide a fluent, chainable API** – A way to compose operations (e.g., map then filter then collect) without deeply nested callbacks. The exact method names and structure are up to you.
2. **Support lazy evaluation** – Transformations should build a pipeline; execution occurs only when an action is triggered. Where possible, consecutive narrow transformations (map, filter) should be fused into a single MapReduce job.
3. **Ensure function serialization** – User-provided functions must execute correctly on remote workers. You may use `util.compile`, string serialization, or another approach.

## Operations to Implement

### Core Transformations

- **map**: Apply a function to each (key, value) pair; produce one output per input.
- **flatMap**: Apply a function; each input may yield zero or more outputs.
- **filter**: Keep only elements for which a predicate returns true.
- **distinct**: Remove duplicate keys (or key-value pairs) from the dataset. Support `opts.byPair` to deduplicate by (key, value) instead of key alone.
- **reduceByKey**: For each key, aggregate all associated values using a binary function.
- **groupByKey**: For each key, collect all associated values into a single collection.

### Set Operations

- **union**: Combine two datasets; duplicates may appear.
- **intersection**: Elements present in both datasets.
- **subtract**: Elements in the first dataset but not the second.

### Ordering

- **sortByKey**: Sort key-value pairs by key (ascending or descending). When the key count exceeds a configurable threshold, use distributed sort (range partitioning by key boundaries, map-shuffle-reduce, local sort per partition, merge in order) instead of collect-then-sort. Options: `distributedSortThreshold`, `ascending`.

### Joins

- **join**: Inner join—for matching keys, produce (key, (value1, value2)).
- **leftOuterJoin**, **rightOuterJoin**: Outer join variants; missing values represented as null or equivalent.

### Actions

- **collect**: Return all elements to the caller.
- **count**: Return the total number of elements.
- **first**: Return the first element.
- **take(n)**: Return the first n elements.
- **reduce**: Aggregate the entire dataset using a binary function.
- **foreach**: Apply a function to each element (e.g., for side effects).

## Fluent API Guidance

Your fluent API should support at least:

- An entry point (e.g., from a key set or dataset reference)
- Transformations: map, filter, flatMap (flatMap may be followed by map, filter, or flatMap before an action)
- Actions: collect, count, and reduce

Example of the intended *style* (adapt to your design):

```
entryPoint(keys).map(...).filter(...).collect(callback)
entryPoint(keys).map(...).count(callback)
entryPoint(keys).map(...).reduce(fn, zero, callback)
```

Key properties: transformations return a chainable object; no execution until an action is called; consecutive map/filter can be fused into one MapReduce job.

## Error Handling

- MapReduce worker errors (in map or reduce phases) must propagate to the caller. If any worker throws or returns an error, the operation callback should receive an error rather than partial or empty results.

## Constraints

- Operations must run across a node group (use `groups`, `store`, `mem`, `comm`).
- User-provided functions must be serializable for execution on remote nodes.
- Integrate with the existing store and mem services for data placement and retrieval.
- The M5 MapReduce implementation is a valid building block; you may extend or wrap it.

## References

- Apache Spark RDD Programming Guide: https://spark.apache.org/docs/latest/rdd-programming-guide.html
- Your M5 implementation: `distribution/all/mr.js`, `distribution/local/store.js`, `distribution/local/mem.js`

## Performance Evaluation

Implementations should be amenable to performance measurement. A performance script (e.g., `p6.js`) should:

- **Measure latency** – End-to-end time (ms) for key operations: collect, count, map+collect, filter+collect, flatMap+collect, sortByKey, join.
- **Vary dataset size** – Run benchmarks at multiple scales (e.g., 100, 500, 1000, 2000, 5000 elements) to observe scaling behavior.
- **Vary worker count** – Run benchmarks with 1, 2, and 3 workers to demonstrate the benefit of horizontal scaling.
- **Report results** – Output a table of mean latency (ms) per operation, dataset size, and worker count.
- **Visualize** – Generate an HTML report (e.g., `p6-results.html`) with line charts showing latency vs dataset size (one line per worker count) and a summary chart.

Results need not meet specific thresholds; the goal is to provide a reproducible baseline for comparing implementations and understanding where time is spent (narrow vs wide transformations, shuffle-heavy ops).

## Deliverables

- A working implementation of the operations above (or a substantial subset).
- Tests that demonstrate correctness (use a manual test script; Jest may be slow).
- A performance script (e.g., `p6.js`) that measures and reports latency for the operations above.
- A brief report summarizing your design, challenges, and any extra features.

## Notes

- Lazy evaluation and pipeline fusion are expected for the fluent API; lineage and fault tolerance are not.
- Prioritize operations that map naturally to M5's map-shuffle-reduce pipeline.
- Multi-dataset operations (join, union, intersection, subtract) require coordinating two input sources.
