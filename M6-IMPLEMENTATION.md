# M6 Implementation Plan

## Architecture

Extend M5 by adding a new `spark` service that provides Spark-like operations. The spark service composes or wraps `mr.exec` with appropriate map/reduce/compact configurations. The `mr` module is extended to propagate worker errors to the caller.

```
distribution.all.spark
  ├── fromKeys(keys) → RDD (fluent entry point)
  ├── map, flatMap, filter, distinct, count, collect, ...
  └── RDD: .map(), .filter(), .flatMap(), .collect(), .count(), .reduce()
```

### Fluent RDD API

- **`spark.fromKeys(keys)`** – Returns an RDD object with lazy pipeline.
- **Transformations** (`.map(fn)`, `.filter(fn)`, `.flatMap(fn)`) – Append to pipeline, return new RDD. No execution.
- **Actions** (`.collect(cb)`, `.count(cb)`, `.reduce(fn, zero, cb)`) – Execute pipeline, invoke callback.
- **Pipeline fusion** – Consecutive map/filter ops are fused into a single MapReduce job.

### Function Serialization

- Use `util.compile` with `eval("__PLACEHOLDER__")` to inline user functions for map, filter, flatMap, foreach, and **reduceByKey** (map + reduce).

## Implementation Phases

### Phase 1: Narrow Transformations (map, flatMap, filter)

- **map** / **flatMap**: Already supported by `mr.exec`—mapper returns array of `{key: value}`.
- **filter**: Map returns `[]` or `[{[key]: value}]` based on predicate. Use compact to drop empty. Or: map returns `[]` for filtered-out, `[{[key]: value}]` for kept; compact filters out keys with empty value arrays.
- **mapOnly**: For operations that don't need reduce (e.g., map then collect), use reduce that passes through: `(k, vals) => ({[k]: vals[0]})` for single value, or concatenate for flatMap.

### Phase 2: Wide Transformations (distinct, reduceByKey, groupByKey)

- **distinct**: Map `(k, v) => [{[k]: k}]` (keep key only). Reduce `(k, vals) => ({[k]: vals[0]})`. Dedupes by key. For `opts.byPair`, emit composite key `__pair_${hash(key,value)}` with `{key, value}`; reduce keeps one per composite key; post-process to `{[key]: value}`. Hash logic must be inlined in map (no external function refs) for worker serialization.
- **reduceByKey**: Use `util.compile` to inline user map and reduce so they serialize correctly on workers.
- **groupByKey**: Map `(k, v) => [{[k]: v}]`, Reduce `(k, vals) => ({[k]: vals})` (identity collect).

### Phase 3: Actions (count, collect, first, take)

- **collect**: Use `mr.exec` without `out`; callback receives results.
- **count**: Map `(k, v) => [{"__count__": 1}]`, Reduce `(k, vals) => ({"__count__": vals.reduce((a,b)=>a+b, 0)})`. Then sum all `__count__` values in callback. Simpler: map each to count key, single reduce.
- **first** / **take(n)**: Run full mr, then slice results on orchestrator.

### Phase 4: Set Operations (union, intersection, subtract)

- **union**: Get keys from both groups, concatenate. Run mr with combined keys. Handle duplicate keys (union keeps both or merges—spec says duplicates may appear).
- **intersection** / **subtract**: Require two key sets. Shuffle both to same partitioner, then compute set logic. May need two mr rounds or custom worker.

### Phase 5: Joins and sortByKey (stretch)

- **join**: Co-group by key. Requires loading both datasets, shuffling by key, then cross-product of value lists.
- **sortByKey**: When `keys.length < distributedSortThreshold` (default 8), collect then sort on orchestrator. Otherwise: range partitioning by key boundaries, map emits `(partitionId, {key, value})`, reduce sorts each partition locally, merge in partition order. Options: `distributedSortThreshold`, `ascending`. Use `util.compile` to inline `__BOUNDARIES__` into map.

### Phase 6: Error Propagation and Extended Fluent API

- **Error propagation (mr.js)**: In `workerMap` and `workerReduce`, catch thrown errors and store under `__mr_error__` instead of swallowing. In `runOperation` callback, if any result has `__mr_error__`, call callback with `new Error(errItem.__mr_error__)` instead of passing partial results.
- **Fluent flatMap + more ops**: Support `flatMap` followed by `map`, `filter`, or `flatMap` before an action. Use `_runWithFlatMap` with `afterFlatMap` pipeline; apply subsequent ops to flat results on orchestrator (or extend to distributed if needed).

## Key Files

| File | Purpose |
|------|---------|
| `distribution/all/spark.js` | Spark service (distinct byPair, distributed sortByKey, fluent flatMap+ops) |
| `distribution/all/mr.js` | MapReduce with error propagation |
| `distribution/all/all.js` | Register spark service |
| `distribution.js` | Wire spark into groups (via all.js) |
| `t6.js` | Manual test script (distinct byPair, fluent flatMap+map+collect) |

## Data Model

- Store keys are strings. Values are arbitrary (serializable).
- Spark uses (K, V) tuples; we use `{[key]: value}` objects. Map between as needed.
- For multi-dataset ops, use two groups or two key arrays; spark methods accept `keys` and optionally `keysB` or `groupB`.

## Testing Strategy

Use `t6.js` (like `t.js`) to:
1. Start node + spawn workers
2. Create group, put test data
3. Call spark operations
4. Log results, verify manually

Avoid Jest for M6 tests due to slowness; use manual script for iteration.
