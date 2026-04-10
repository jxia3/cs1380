# M6: Spark-Inspired Distributed Data Processing

## Overview

Extend the distributed execution engine (M5) with a richer set of data processing operations inspired by Apache Spark's RDD API. Build on the existing MapReduce, store, and mem services so that work runs on workers in a node group wherever the operation allows. The handout expects implementations you can test for correctness and reason about without moving every intermediate through the orchestrator by default.

## Scope

The milestone includes: implementing the operations below with a usable API; verifying correctness; running a performance study with structured configurations; completing the capstone final check (dataset and operation sequence in [`m6-capstone/`](m6-capstone/)); and submitting a short report. Details appear in the corresponding sections.

For the core implementation, you may choose:

- How to expose operations (new service, extended `mr`, fluent API, or similar)
- How to handle partitioning and shuffling
- The exact API shape: callbacks, configuration objects, method names

### Substantial Requirements

To qualify as a substantial improvement over M5, your implementation must:

1. Provide a fluent, chainable API so users can compose operations (for example map then filter then collect) without deeply nested callbacks. Exact names and structure are yours; see API Guidance.

2. Use lazy evaluation for transformations: do not run MapReduce jobs or pull large results to the orchestrator until an action runs (`collect`, `count`, `first`, `take`, `reduce`, `foreach`, …). Calls such as `map`, `filter`, `flatMap`, `distinct`, `reduceByKey`, `groupByKey`, set ops, `sortByKey`, or joins on the pipeline should only record work until then. Document any narrow exception (for example a helper that materializes for debugging) so it does not substitute for the required lazy pipeline.

3. Ensure user-provided functions execute correctly on remote workers. Pick a serialization strategy your engine can support and document it. Do not rely on a specific helper from starter code unless the course hands it to you explicitly.

4. Prefer distributed work on workers for large data. The orchestrator should not be the default place to expand, sort, or join entire datasets when the same semantics can be obtained with worker-side stages. See Distributed execution expectations.

### Distributed execution expectations

Unless the operation inherently needs the full dataset on the orchestrator, run transformations and wide operations as distributed stages where applicable (map, filter, flatMap expansion, per-key aggregation, sort partitioning, join prep, set logic in MapReduce-style work). Avoid a second full scan on the orchestrator after a distributed stage when another stage could preserve semantics. Use the orchestrator to merge partitions or summaries, build small key lists when needed, and invoke callbacks.

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

- You may use a fluent chain, a builder, or another clear pattern. The handout expects practical usability, not a single prescribed class name.
- Expose a clear entry point (key list, group name, dataset handle, or equivalent).
- Transformations return a new object or descriptor for the extended pipeline; they must not run the pipeline eagerly.
- Actions accept a callback (or use Promises if your environment allows) and trigger execution.
- **Fusion** is an optional optimization: where semantics allow, combine consecutive transformations into fewer distributed jobs instead of one job per step. Narrow pipelines (map, filter, flatMap and similar) are common candidates; you may fuse other adjacent stages when your design can preserve semantics.
- Keep naming and verbs consistent; document whether keys are strings, how the group is chosen, and how two-input operations name the second key list or dataset.
- Illustrative style only:

  ```
  entryPoint(keys).map(...).filter(...).collect(callback)
  entryPoint(keys).map(...).count(callback)
  entryPoint(keys).map(...).reduce(fn, zero, callback)
  ```

## Error handling

Failures must reach the caller through a single, predictable path: **actions** should pass an error to the callback or reject the Promise (whichever matches your API). A failed run must not look like success with empty or partial results unless the operation’s semantics truly allow that (for example an empty output from a filter is not a failure).

User code that throws or rejects on workers, failures reading or writing through the store and mem services, and errors during orchestrator-side merges or final steps must propagate the same way—do not drop keys, substitute empty datasets, or skip partitions silently. If a function or value cannot be serialized or executed remotely, fail when the pipeline runs (or at first execution) with a clear message rather than undefined behavior on workers.

Worker crashes, lost messages, timeouts, or other distributed failures should fail the affected action with an identifiable error, not a silent success; avoid hanging without a documented limit. If several stages or partitions fail, you may surface the first error or a short summary; say which in your documentation. Logging may help debugging but does not replace reporting errors through the action API.

## Correctness verification

Correctness matters as much as feature coverage. Plan a testing strategy, run it as you develop, and document how to reproduce your checks. Cover edge cases (empty or tiny inputs, duplicates, multi-key partitions), multi-dataset and ordering-sensitive cases, and failure paths. Add regressions when fixing bugs. Automation style (scripts, frameworks, ad hoc runs) is up to your course.

Use coding agents to help design tests and interpret failures; you remain responsible that behavior matches this spec and that tests actually show it. Accepting generated tests you do not understand is not sufficient.

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

### Workloads

Report latency for each of these workloads (name them clearly in your tables and charts):

- `collect` over the dataset keys
- `count` over the dataset keys
- map then collect (fluent pipeline or your API’s equivalent)
- filter then collect
- flatMap then collect
- `sortByKey`
- `join` (inner join on two key lists derived from the dataset)

Also measure **at least two additional workloads** that use more complex operations from this spec—for example `reduceByKey`, `groupByKey`, `distinct`, an outer join (`leftOuterJoin` or `rightOuterJoin`), a set operation (`union`, `intersection`, or `subtract`), or a longer fluent chain. Describe what each additional workload does.

### Configurations to measure

Use at least these settings so results are comparable:

- Dataset sizes (number of keys): 100, 500, 1000, 2000, and 5000 (or a similar spread if you document it).
- Worker counts: 1, 2, and 3 workers, repeating the same sizes at each count.
- Metrics: end-to-end latency in milliseconds; report mean latency per workload, dataset size, and worker count (or another clearly stated aggregate). Optional: multiple runs per configuration to show variance.
- Output: an HTML report with line charts of latency versus dataset size (one series per worker count) and a short summary chart or table; state in your submission where the report is written (path or filename).

Results need not hit a fixed target; aim for a reproducible baseline. Relate timing briefly to your correctness tests.

## Deliverables

- Implementation of the listed operations or a subset your instructor approves.
- Tests and enough description that someone can understand how you validated correctness.
- The performance script and generated report as above.
- A short report: design, how you verified correctness, difficulties, optional features.

## Capstone final check

The course provides a dataset and a step-by-step operation list in [`m6-capstone/README.md`](m6-capstone/README.md). Load `data.json` into your store, then implement the sequence in order:

1. A lazy fluent pipeline on all record keys (filter, map, flatMap, an additional filter, then `collect`) — output fluentCollect.
2. `sortByKey` on `keysForSort` — output sortByKey.
3. `join` on `keysJoinA` and `keysJoinB` — output join.
4. `groupByKey` on `keysForGroupByKey` — output groupByKey.
5. `reduceByKey` with the map/reduce functions and key list `keysForReduceByKey` exactly as specified in the README — output reduceByKey.

Canonicalize all five arrays as described there and compare to `expected.json`. There is no official student script you must run; submissions will differ in structure and naming. The repository provides `node m6/check-capstone.js <your-output.json>` for self-check; instructors regenerate `expected.json` when the dataset or published semantics change.

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
