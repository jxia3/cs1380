# M6: Spark-Inspired Distributed Data Processing

## Overview

Extend the distributed execution engine (M5) with a richer set of data processing operations inspired by Apache Spark's RDD API. Your implementation should build on the existing MapReduce, store, and mem services. The goal is to provide Spark-like transformations and actions that run across a node group.

## Scope

Implement a set of transformations and actions that operate on distributed key-value data. You have freedom over:

- How to expose these operations (new service, extended `mr`, fluent API, etc.)
- Whether to support lazy evaluation or eager execution
- How to handle partitioning and shuffling
- The exact API shape (callbacks, config objects, method names)

## Operations to Implement

### Core Transformations

- **map**: Apply a function to each (key, value) pair; produce one output per input.
- **flatMap**: Apply a function; each input may yield zero or more outputs.
- **filter**: Keep only elements for which a predicate returns true.
- **distinct**: Remove duplicate keys (or key-value pairs) from the dataset.
- **reduceByKey**: For each key, aggregate all associated values using a binary function.
- **groupByKey**: For each key, collect all associated values into a single collection.

### Set Operations

- **union**: Combine two datasets; duplicates may appear.
- **intersection**: Elements present in both datasets.
- **subtract**: Elements in the first dataset but not the second.

### Ordering

- **sortByKey**: Sort key-value pairs by key (ascending or descending).

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

## Constraints

- Operations must run across a node group (use `groups`, `store`, `mem`, `comm`).
- User-provided functions (map, filter, reduce, etc.) must be serializable for execution on remote nodes.
- Integrate with the existing store and mem services for data placement and retrieval.
- The M5 MapReduce implementation is a valid building block; you may extend or wrap it.

## References

- Apache Spark RDD Programming Guide: https://spark.apache.org/docs/latest/rdd-programming-guide.html
- Your M5 implementation: `distribution/all/mr.js`, `distribution/local/store.js`, `distribution/local/mem.js`

## Deliverables

- A working implementation of the operations above (or a substantial subset).
- Tests that demonstrate correctness (use a manual test script; Jest may be slow).
- A brief report summarizing your design, challenges, and any extra features.

## Notes

- You are not required to implement lazy evaluation, lineage, or fault tolerance.
- Prioritize operations that map naturally to M5's map-shuffle-reduce pipeline.
- Multi-dataset operations (join, union, intersection, subtract) require coordinating two input sources.
