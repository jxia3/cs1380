# M6 Implementation Plan

## Architecture

Extend M5 by adding a new `spark` service that provides Spark-like operations. The spark service composes or wraps `mr.exec` with appropriate map/reduce/compact configurations. The `mr` module propagates worker map/reduce errors and store read failures to the caller via `__mr_error__` aggregation in `runOperation`.

```
distribution.all.spark
  ├── fromKeys(keys) → RDD (fluent entry point)
  ├── map, flatMap, filter, distinct, count, collect, join, sortByKey, ...
  └── RDD: .map(), .filter(), .flatMap(), .collect(), .count(), .reduce()
```

### Fluent RDD API

- **`spark.fromKeys(keys)`** – Returns an RDD object with lazy pipeline.
- **Transformations** (`.map(fn)`, `.filter(fn)`, `.flatMap(fn)`) – Append to pipeline, return new RDD. No execution until an action.
- **Actions** (`.collect(cb)`, `.count(cb)`, `.reduce(fn, zero, cb)`) – Execute pipeline, invoke callback.
- **Pipeline fusion** – Consecutive **map/filter** ops are fused into a **single** `mr.exec` job (compiled mapper).
- **Fluent pipelines with `flatMap`** – The first `flatMap` and any **suffix** map/filter/flatMap run in **one distributed MR job**: the mapper is generated to apply prefix narrow ops (if any), then `flatMap`, then suffix ops on workers. Results are reduced and flattened the same way as imperative `flatMap`. No orchestrator-side `results.flatMap` for the expansion step.

### Function Serialization

- Use `util.compile` with `eval("__PLACEHOLDER__")` to inline user functions for map, filter, fused pipelines, flatMap chains, foreach, **reduceByKey**, **sortByKey** (map + reduce with `__BOUNDARIES__` / `__ASCENDING__`).

## Implementation Phases (as built)

### Phase 1: Narrow transformations (map, flatMap, filter)

- **map** / **imperative flatMap**: `mr.exec` with mapper returning arrays of `{key: value}`; reduce collapses per key as needed.
- **filter**: Map emits `[]` or `[{[key]: value}]`; reduce keeps first value.

### Phase 2: Wide transformations (distinct, reduceByKey, groupByKey)

- **distinct**: By key: map/reduce dedupe. **`opts.byPair`**: hash `(key,value)` to `__pair_*` partition keys; reduce keeps one row per pair.
- **reduceByKey**: `util.compile` on user map and reduce.
- **groupByKey**: Map `(k, v) => [{[k]: v}]`, reduce `(k, vals) => ({[k]: vals})`.

### Phase 3: Actions (count, collect, first, take)

- **collect** / **count**: Identity or `__count__` pattern via `mr.exec`.
- **first** / **take(n)**: `collect` then orchestrator slice (same ordering assumptions as MR merge order).
- **Dataset-wide reduce**: `collect` then fold on orchestrator (non-associative `fn` in general).

### Phase 4: Set operations (union, intersection, subtract)

- **union**: Single MR over `keysA.concat(keysB)`; reduce gathers values per key; callback flattens to one `{k:v}` per list element.
- **intersection**: `keysA.filter` with `Set(keysB)`, then `distinct` on filtered keys.
- **subtract**: `keysA.filter` against `Set(keysB)`, then `collect`.

### Phase 5: Joins and sortByKey

- **join** / **leftOuterJoin**: **One** `collect` over **`unionUniqueKeys(keysA, keysB)`** (deduped union), building a key→value map from results. Inner join: `keysA.filter(k => keysB has k)`. Left outer: one row per `keysA` entry; right-hand value is `null` when the key is not in B’s membership **or** missing from store (`k in byKey` check). **Right outer join** delegates to swapped left outer + column swap. Same single-store value for both sides when the key appears in both lists.
- **sortByKey**: **Always** uses the distributed path: sorted key array → range-style partition boundaries → map assigns `__sort_{pid}` → **reduce** sorts each partition with **`util.compile`**’d ascending flag (workers do not rely on broken closures). Merge by partition id on orchestrator. The `distributedSortThreshold` option remains in the API for compatibility but is **ignored** (always distributed).

### Phase 6: Error propagation and MR

- **`mr.js` `workerMap`**: Thrown errors in user map → `__mr_error__`. **`store.get` error** → pushed to `__mr_error__` (no silent skip).
- **`workerReduce`**: Thrown errors in reduce → `{ __mr_error__: message }`.
- **`runOperation`**: If any flattened result contains `__mr_error__`, callback receives `new Error(...)`; no silent partial success for those paths.

## Key Files

| File | Purpose |
|------|---------|
| `distribution/all/spark.js` | Spark service: fusion, distributed fluent flatMap, union-key joins, distributed sortByKey, helpers `unionUniqueKeys` / `indexResultsByKey` |
| `distribution/all/mr.js` | MapReduce `exec`; error propagation for map/reduce/store |
| `distribution/all/all.js` | Registers `spark` service |
| `distribution.js` | Loads distribution; `disableLogs` / `_disableLogs` on node config |
| `m6/t6.js` | Manual integration tests for spark ops |
| `test/test-student/m6.student.test.js` | Jest coverage for spark |
| `m6/p6.js` | Performance benchmark → `p6-results.html` at repository root |
| `assignment/M6-SPEC.md` | Milestone handout |
| `assignment/m6-capstone/` | Capstone dataset and expected output |
| `scripts/kill-ports.sh` | Frees test ports (including Jest/MR ranges) before manual scripts |

## Data Model

- Store keys are strings. Values are arbitrary (serializable).
- We use `{[key]: value}` objects; multi-dataset ops use two key arrays against the **same** group store unless extended.

## Testing Strategy

- `m6/t6.js`: Spawn workers, load data, sequential checks (`./scripts/run-test.sh m6/t6.js`).
- **`m6.student.test.js`**: Jest suite against configured groups.
- Prefer freeing ports via `scripts/kill-ports.sh` before long runs.

## Performance Benchmarking (`m6/p6.js`)

- **Setup**: Phases for worker counts 1, 2, 3 (`NODES` env). Synthetic keys `k00`…, values `v…`.
- **Dataset sizes**: Default 100, 500, 1000, 2000, 5000 (`SIZES` env).
- **Runs per op**: Default 2 (`RUNS` env).
- **Operations**: collect, count, fluent map/filter/flatMap+collect, reduceByKey, groupByKey, distinct, sortByKey, join, leftOuterJoin, union.
- **Logging**: `require("./distribution/util/log.js"); log.disable()` **before** `require("./distribution.js")`. Spawned workers pass **`_disableLogs: true`** in node config so child processes do not flood inherited stdio (avoids backpressure hangs). **`global.nodeConfig._disableLogs = true`** on orchestrator. Optional **`P6_VERBOSE=1`** for progress lines.
- **Timeouts**: **`P6_OP_TIMEOUT_MS`** (default 180000) per benchmark invocation prevents infinite hang if MR stalls. Shell wrapper: use adequate **`TIMEOUT`** with `./scripts/run-test.sh m6/p6.js` (e.g. 600–900s for full default grid).
- **Correctness**: `timeOp` propagates errors; benchmark failure stops the phase with `cb(err)`.
- **Output**: `p6-results.html` at repository root — line charts (with point markers for single-size series), scaling chart for collect, raw data table.
- **Charts**: Line charts draw polylines when ≥2 points; **circles** mark each point so single-size runs are visible.

## Non-goals (unchanged)

- Streaming `collect` or paging `mr.exec` results.
- Cross-group / two-store joins without API extension.
- `mr.exec` still returns full result arrays to the orchestrator per job (driver memory scales with output size).
