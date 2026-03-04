# M6 Evaluation and Improvement Plan

## 1. Assignment Evaluation

### Does M6 Satisfy "Substantial Improvement to M5"?

**Yes, with caveats.** The assignment meaningfully extends M5 in several ways:

| Aspect | M5 | M6 | Improvement |
|--------|----|----|-------------|
| **Abstraction level** | Raw `mr.exec` with map/reduce/compact | Named operations (map, filter, join, etc.) | Users express intent instead of wiring map-reduce by hand |
| **API surface** | Single entry point | 19 operations | Richer vocabulary for common patterns |
| **Composability** | Manual chaining of mr.exec calls | Operations compose naturally (e.g., filter → map → collect) | Easier to build pipelines |
| **Multi-dataset ops** | Not supported | union, intersection, subtract, join | Enables relational-style workflows |
| **Serialization** | User must ensure functions serialize | `util.compile` inlines user functions | Reduces a major source of bugs |

**Gaps relative to "substantial":**

- **Single-group assumption**: All operations assume one store/group. True cross-group joins (e.g., two groups with different stores) would require more infrastructure.
- **No distributed sort**: `sortByKey` collects and sorts on the orchestrator—fine for small data, but not a distributed merge-sort.
- **No lazy evaluation**: Each operation runs immediately. Spark’s lazy evaluation and lineage are central to its design; this assignment explicitly avoids them.

**Verdict**: The assignment is a solid improvement that teaches higher-level abstractions without overreaching. It fits well within the course scope.

---

## 2. Implementation Evaluation

### Strengths

1. **Clean composition over `mr.exec`**: The spark service is a thin layer that configures map/reduce/compact and delegates to `mr.exec`. No changes to the core `mr` module—good separation of concerns.

2. **Function serialization**: Using `util.compile` with `eval("__PLACEHOLDER__")` to inline user functions is the right approach. Functions are serialized as source strings and reconstructed on workers, avoiding closure issues.

3. **Consistent validation**: Input validation (keys array, function types) is present across operations.

4. **Reuse of primitives**: `collect`, `distinct`, and `groupByKey` are used internally by other operations (e.g., `intersection` → `distinct`, `reduce` → `collect`), reducing duplication.

5. **Full coverage**: All 19 spec operations are implemented.

### Weaknesses / Risks

1. **Orchestrator bottleneck**: `reduce`, `join`, `leftOuterJoin`, `rightOuterJoin`, and `sortByKey` all collect the full dataset to the orchestrator. For large data, this is a memory and network bottleneck.

2. **Single-store semantics**: `join` and set operations assume both datasets live in the same group’s store. Keys are the only identifiers; there is no notion of "dataset A" vs "dataset B" beyond key arrays.

3. **`reduceByKey` and user functions**: `reduceByKey` passes user map/reduce directly to `mr.exec` without `util.compile`. If those functions close over variables, they will fail on workers. The spec says "user-provided functions must be serializable," but the implementation does not enforce or assist this for `reduceByKey`.

4. **Error handling**: Worker-side errors in map/reduce are caught and swallowed (e.g., in `mr.js` workerMap). The user may get empty results instead of an error.

5. **`distinct` semantics**: The implementation deduplicates by key only. The spec says "duplicate keys (or key-value pairs)"—distinct by (key, value) would require a different implementation.

### Code Quality

- **Readability**: Good. JSDoc and clear function names.
- **Consistency**: Callback-style API is consistent with the rest of the distribution framework.
- **Modularity**: Spark is a separate service; no coupling to `mr` internals.

---

## 3. Potential Improvements and Extensions

### High Educational Value

| Extension | Description | Learning |
|-----------|-------------|----------|
| **Lazy evaluation / lazy RDD** | Return a "plan" object; execute only on `collect`/`count`/`reduce` | Query optimization, deferred execution |
| **Distributed sortByKey** | Merge-sort across partitions; range partitioner | Partitioning, shuffling, ordering |
| **Cross-group join** | Join two groups with different stores | Multi-group coordination, data movement |
| **Function serialization helper** | `spark.serializable(fn)` or wrapper that uses `util.compile` | Serialization, debugging |
| **Pipeline optimization** | Combine multiple map/filter into one MR job | Query planning, optimization |

### Medium Educational Value

| Extension | Description | Learning |
|-----------|-------------|----------|
| **`fold` / `aggregate`** | Like reduce but with a neutral element and combine function | Associative/commutative semantics |
| **`cogroup`** | Group values from multiple datasets by key | Foundation for join |
| **`sample`** | Random sampling with/without replacement | Probabilistic algorithms |
| **`coalesce` / `repartition`** | Control number of partitions | Partitioning, load balancing |
| **Error propagation** | Surface worker errors instead of returning empty | Debugging, observability |

### Lower Priority / Stretch

| Extension | Description | Learning |
|-----------|-------------|----------|
| **Lazy lineage** | Track lineage for fault tolerance | Recovery, replay |
| **`persist` / `cache`** | Materialize intermediate results | Caching, memory management |

---

## 4. RDD-Like Fluent API (High Value)

### The Problem: Callback Hell

The current API forces deeply nested callbacks:

```javascript
distribution.m6.spark.map(keys, (k, v) => ({[k]: v.toUpperCase()}), (err, mapped) => {
  if (err) return done(err);
  distribution.m6.spark.filter(mappedKeys, (k) => k.startsWith("a"), (err, filtered) => {
    if (err) return done(err);
    distribution.m6.spark.collect(filteredKeys, (err, results) => {
      if (err) return done(err);
      // finally use results...
    });
  });
});
```

Worse: `map` and `filter` return *results* (key-value pairs), but the next operation needs *keys*. The user must manually extract keys at each step, which is error-prone and verbose.

### The Solution: Fluent RDD-Like API

Yes, an RDD-like API is possible and would significantly improve ergonomics. The idea is to wrap the pipeline in an object that supports method chaining and defers execution until an *action* (collect, count, reduce) is called.

**Proposed usage:**

```javascript
// Lazy pipeline: build a DAG, execute on action
const rdd = distribution.m6.spark.fromKeys(keys)
  .map((k, v) => ({[k]: v.toUpperCase()}))
  .filter((k) => k.startsWith("a"));

rdd.collect((err, results) => { /* ... */ });
rdd.count((err, n) => { /* ... */ });
```

**With Promises (optional):**

```javascript
const results = await distribution.m6.spark.fromKeys(keys)
  .map((k, v) => ({[k]: v.toUpperCase()}))
  .filter((k) => k.startsWith("a"))
  .collect();  // returns Promise<results>
```

### Design Sketch

1. **`spark.fromKeys(keys)`** – Returns an `RDD` object holding `{ gid, keys, ops: [] }`.

2. **Transformations return new RDDs** – `.map(fn)`, `.filter(fn)`, `.flatMap(fn)`, `.distinct()` each push an op to the pipeline and return a new RDD (or mutate and return `this`). No execution yet.

3. **Actions trigger execution** – `.collect(cb)`, `.count(cb)`, `.reduce(fn, zero, cb)` walk the pipeline, build one or more MR jobs, and invoke the callback with results.

4. **Keys flow through the pipeline** – After each transformation, the RDD holds either:
   - **Keys** (for store-backed data): we always know which keys to read.
   - **Pipeline ops**: each op describes how to transform the previous step’s output.
   - On action: run MR with the right map/reduce derived from the op chain. The tricky part is that `map`/`filter` change the *data* but we need to track *keys* for the next store read—or we run the whole pipeline in one MR job by fusing ops.

5. **Fusion** – Consecutive map/filter can be fused into a single map phase: one MR job instead of three.

### Implementation Options

| Approach | Effort | Pros | Cons |
|----------|--------|------|------|
| **Thin wrapper, eager** | Low | Simple; each step runs immediately but returns a chainable object that holds keys | Still one MR per step; no fusion |
| **Lazy + single-job fusion** | Medium | One MR for map→filter→collect; fewer round-trips | Need to compile op chain into one map fn |
| **Lazy + multi-job** | Medium | Supports wide ops (distinct, groupByKey) between narrow ops | Multiple MR rounds; more complex |
| **Promises** | Low | `async/await` eliminates nesting | Need to promisify the spark service |

### Minimal Viable Fluent API

A low-effort first step:

```javascript
// spark.fromKeys(keys) returns { map, filter, collect, count, ... }
// Each method returns the same object (or a new one) with updated pipeline.
// Only collect/count/reduce actually run.
```

The key insight: **lazy evaluation is what makes the fluent API pay off**. Without it, you still need a callback after each step. With it, you build a pipeline and run it once—and you can optimize (fuse) before execution.

---

## 5. Recommended Implementation Plan

### Phase 1: Hardening (Low Effort)

1. **`reduceByKey` serialization**: Use `util.compile` for user map/reduce when possible, or document that users must pass serializable functions.
2. **Error propagation**: In `mr.js`, capture worker errors and include them in the callback instead of returning empty results.
3. **`distinct` semantics**: Clarify in docs whether distinct is by key or (key, value); add `distinctByKey` and `distinctByPair` if both are needed.

### Phase 2: Distributed Sort (Medium Effort)

1. Implement a range partitioner that sorts keys across partitions.
2. Run a map phase that emits (key, value) to the correct partition.
3. Each partition sorts locally; orchestrator merges sorted streams.

### Phase 3: Fluent API + Lazy Evaluation (High Effort)

1. **`spark.fromKeys(keys)`**: Return an RDD-like object with `.map()`, `.filter()`, etc.
2. **Lazy pipeline**: Transformations push ops onto a DAG; no execution until `.collect()` / `.count()` / `.reduce()`.
3. **Execution**: Build MR plan from the DAG; fuse consecutive map/filter into one job.
4. **Optional**: Promisify for `async/await` to eliminate callback nesting entirely.

### Phase 4: Cross-Group Operations (High Effort)

1. **`join(groupA, keysA, groupB, keysB)`**: Fetch from two groups, shuffle by key, co-group.
2. Requires coordination across groups and possibly cross-group data transfer.

---

## 6. Summary

| Aspect | Rating | Notes |
|--------|--------|-------|
| **Assignment design** | Strong | Clear scope, good balance of flexibility and structure |
| **M5 improvement** | Substantial | Higher-level API, multi-dataset ops, better serialization story |
| **Implementation** | Solid | Complete, correct, composable; some scalability and robustness gaps |
| **Educational value** | High | Good platform for learning Spark concepts, serialization, and distributed design |

The assignment and implementation succeed as a teaching vehicle. The main opportunities for growth are distributed sort, lazy evaluation, and cross-group operations—each of which would deepen understanding of real distributed systems.

---

## 7. Implemented (Post-Evaluation)

The following substantial improvements have been implemented:

- **Fluent RDD-like API**: `spark.fromKeys(keys).map().filter().collect(cb)` with lazy evaluation and pipeline fusion.
- **reduceByKey serialization**: User map and reduce functions are now inlined via `util.compile` for correct worker execution.
- **Pipeline fusion**: Consecutive map/filter operations are fused into a single MapReduce job.
- **flatMap in fluent API**: Supported via `_runWithFlatMap` (runs prior ops, then flatMap on the orchestrator).
