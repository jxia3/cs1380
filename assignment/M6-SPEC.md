# M6: Spark-Inspired Distributed Data Processing

## Overview

Extend the distributed execution engine (M5) with a richer set of data processing operations inspired by Apache Spark's RDD API. Build on the existing MapReduce, store, and mem services so that work runs on workers in a node group wherever the operation allows. The handout expects implementations you can test for correctness and reason about without moving every intermediate through the orchestrator by default.

## Scope

Implement transformations and actions over distributed key-value data. You may choose:

- How to expose operations (new service, extended `mr`, fluent API, or similar)
- How to handle partitioning and shuffling
- The exact API shape: callbacks, configuration objects, method names

Lazy evaluation is not optional; see Substantial Requirements.

### Substantial Requirements

To qualify as a substantial improvement over M5, your implementation must:

1. Provide a fluent, chainable API so users can compose operations (for example map then filter then collect) without deeply nested callbacks. Exact names and structure are yours; see API Guidance.

2. Use lazy evaluation for transformations. Building a pipeline must not run MapReduce jobs or pull large results to the orchestrator until an action runs. Calling `map`, `filter`, `flatMap`, `distinct`, `reduceByKey`, `groupByKey`, set ops, `sortByKey`, or joins on a pipeline object should only record work. Execution starts when the user invokes an action such as `collect`, `count`, `first`, `take`, `reduce`, or `foreach`. Document any narrow exception (for example a helper that materializes for debugging) so it does not substitute for the required lazy pipeline.

3. Fuse consecutive narrow steps where reasonable so that multiple transformations do not each trigger a full round trip when a single distributed stage would match the semantics. Typical candidates are consecutive map and filter; include flatMap in fusion when your design allows.

4. Ensure user-provided functions execute correctly on remote workers. Pick a serialization strategy your engine can support and document it. Do not rely on a specific helper from starter code unless the course hands it to you explicitly.

5. Prefer distributed work on workers for large data. The orchestrator should not be the default place to expand, sort, or join entire datasets when the same semantics can be obtained with worker-side stages. See Distributed execution expectations.

### Distributed execution expectations

Unless the operation inherently needs the full dataset on the orchestrator, structure the implementation so transformations and wide operations run as distributed stages where applicable: map and filter, flatMap output expansion, per-key aggregation, partitioning for sort, join preparation, and set logic expressible in a MapReduce-style job on workers.

Avoid running a distributed stage and then scanning the full result again on the orchestrator when another distributed stage could preserve semantics. Use the orchestrator to merge ordered partitions, merge small summaries, build small key lists for the next stage when unavoidable, and to invoke callbacks.

Orchestrator materialization is acceptable when necessary for:

- Actions that return data to the caller: `collect`, and bounded reads such as `first` and `take(n)` according to your design.
- A global `reduce` with an arbitrary user binary operator that is not known to be associative or commutative; you may combine on workers then finish on the orchestrator, or document a restriction.
- Small control data: sorted key boundaries, configuration, aggregated errors.

The spec does not prescribe one algorithm for every edge case. Solutions that keep large intermediate results off the orchestrator except in the cases above are consistent with the intent of the assignment.

## Operations to Implement

### Core transformations

- map: apply a function to each (key, value) pair; one output per input.
- flatMap: each input may yield zero or more outputs. When chained with other transformations before an action, flatMap should run as part of distributed execution, not only as an orchestrator step after a full collect.
- filter: keep elements for which the predicate is true.
- distinct: remove duplicate keys or duplicate (key, value) pairs; support `opts.byPair` for pair-based deduplication.
- reduceByKey: per key, aggregate values with a binary function (often associative for worker-side combining).
- groupByKey: per key, collect all values into one collection.

### Set operations

- union: combine two datasets; duplicates may appear as defined by your semantics.
- intersection: elements in both datasets.
- subtract: elements in the first dataset but not the second.

### Ordering

- sortByKey: sort by key (ascending or descending). For large inputs, use a distributed sort (for example range partitioning, shuffle, local sort per partition, merge in order). Collecting everything and sorting only on the orchestrator is not sufficient at scale. You may expose `distributedSortThreshold` and `ascending`; if you use a threshold, document behavior above and below it.

### Joins

- join: inner join; for matching keys, produce (key, (value1, value2)).
- leftOuterJoin, rightOuterJoin: missing sides as null or equivalent.

Joins should not depend on two independent full collects of both sides when a single coordinated distributed read over the keys you need can implement the semantics. The exact plan is up to you.

### Actions

- collect: return all elements to the caller.
- count: total number of elements.
- first: first element.
- take(n): first n elements.
- reduce: fold the whole dataset with a binary function; state whether associativity is required for a tree reduce on workers.
- foreach: apply a function for side effects.

## API Guidance

You may use a fluent chain, a builder, or another clear pattern. The handout expects practical usability, not a single prescribed class name.

Entry and chaining:

- Expose a clear entry point (key list, group name, dataset handle, or equivalent).
- Transformations return a new object or descriptor for the extended pipeline; they must not run the pipeline eagerly.
- Actions accept a callback (or use Promises if your environment allows) and trigger execution.
- Support map, filter, and flatMap, including flatMap followed by further map, filter, or flatMap before an action, without forcing the user to flatten manually on the client for the common case.

Actions:

- Support at least collect, count, and reduce (with identity or zero as your API requires).

Fusion:

- Combine consecutive map and filter (and flatMap when your design allows) into as few distributed jobs as is reasonable.

Naming:

- Keep verbs and parameter order consistent. Document whether keys are strings, how the group is chosen, and how two-input operations name the second key list or dataset.

Illustrative style only:

```
entryPoint(keys).map(...).filter(...).collect(callback)
entryPoint(keys).map(...).count(callback)
entryPoint(keys).map(...).reduce(fn, zero, callback)
```

## Error handling

Worker errors in map or reduce must reach the caller: the action callback should receive an error, not a silent empty success. If workers read from the store, surface read failures rather than dropping keys without notice.

## Correctness verification

Correctness matters as much as feature coverage. You should plan a testing strategy, run it as you develop, and document enough for someone else to reproduce your checks. General approaches include exercising edge cases (empty or tiny inputs, duplicates, multi-key partitions), multi-dataset operations, ordering-sensitive operations, and failure paths so errors surface instead of disappearing. Regression checks when fixing bugs are good practice. How you automate (scripts, test frameworks, ad hoc runs) is up to you and your course.

Part of this milestone is learning to use coding agents effectively: use them to help design tests and interpret failures, but you remain responsible for validating that behavior matches the spec and that your tests actually prove what you claim. Blindly accepting generated tests without understanding them does not meet the intent of this section.

## Constraints

- Use the platform’s groups, store, mem, and comm abstractions so work runs across a node group.
- User functions must be serializable for remote execution; document limitations such as closures and captured globals.
- Integrate with the existing store and mem services.
- You may extend or wrap M5’s MapReduce implementation.
- Default to a single group and single store for multi-dataset operations unless you implement an optional cross-group extension; state the assumption in your report.
- Be explicit about memory: `collect` and similar actions necessarily bound output by orchestrator capacity. Do not describe the pipeline as distributed if every transformation eagerly pulls all values to the orchestrator unless that matches the exceptions in this document.

## References

- Apache Spark RDD Programming Guide: https://spark.apache.org/docs/latest/rdd-programming-guide.html
- M5: `distribution/all/mr.js`, `distribution/local/store.js`, `distribution/local/mem.js`

## Performance evaluation

Provide a script that measures your implementation and summarizes results in a report.

- Latency (ms), end-to-end, mixing narrow and heavier work: include collect, count, and fluent chains such as map+collect, filter+collect, flatMap+collect; also include several non-trivial operations—for example `reduceByKey`, `groupByKey`, `distinct`, `sortByKey`, a join (`join` plus `leftOuterJoin` or `rightOuterJoin`), and a set operation (`union`, `intersection`, or `subtract`)—so aggregations, shuffles, and multi-dataset paths are represented.
- Dataset sizes: at least 100, 500, 1000, 2000, and 5000 keys (or similar spread).
- Worker counts: 1, 2, and 3 workers for the same sizes.
- Report mean latency (or another clear aggregate) per operation, size, and worker count; optional repeated runs per cell.
- HTML report: line charts of latency versus dataset size (one series per worker count) plus a short summary. Say where the report is written in your submission (path or filename).

Results need not hit a target; aim for a reproducible baseline. Relate timing briefly to your correctness tests.

## Deliverables

- Implementation of the listed operations or a subset your instructor approves.
- Tests and enough description that someone can understand how you validated correctness.
- The performance script and generated report as above.
- A short report: design, how you verified correctness, difficulties, optional features.

## Capstone final check

The course provides a small dataset and an operation checklist in the capstone folder under this assignment directory (see the README there). Load the data into your store, then implement the described sequence of operations (fluent steps plus wide operations) in your own code. There is no official student script you must run; submissions will differ in structure and naming.

A reference `expected.json` is provided for self-check: after applying the same row canonicalization rule described in that README, your three output arrays should match the file. Your course may supply a helper to compare your saved output to that reference; instructors regenerate the reference when the dataset or published semantics change.

## Optional extensions

If core requirements are complete, prefer depth over adding many new operators. Examples:

- Persist and cache: write intermediate results to the store (or a dedicated area) so later actions reuse them without recomputing from scratch; specify unpersist or lifecycle rules.
- Range partitioner: user- or data-driven boundaries for shuffles used by sort, join, or groupByKey; explain how boundaries are chosen.
- Sample: random sampling with or without replacement and configurable fraction or count, with distributed semantics for large inputs rather than collect-then-sample on the client.
- Lineage: record the transformation graph (stages and dependencies) to support debugging, replay, or explaining what will execute; optional hooks into tests or logging.

Other directions (streaming or cross-group execution, fault-tolerant replay from lineage) are appropriate only if you can define correctness and evaluation clearly.

## Notes

- Lazy evaluation and fusion apply to the core API; fault tolerance is out of scope unless you take an extension that defines it.
- Multi-dataset operations need clear tests for both inputs.
- Favor mapping operations to M5’s map-shuffle-reduce model while respecting the distributed expectations section.
