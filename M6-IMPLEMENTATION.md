# M6 Implementation Plan

## Architecture

Extend M5 by adding a new `spark` service that provides Spark-like operations. The spark service composes or wraps `mr.exec` with appropriate map/reduce/compact configurations. No changes to the core `mr` module are required.

```
distribution.all.spark
  ├── filter(keys, predicate, callback)
  ├── distinct(keys, callback)
  ├── count(keys, callback)
  ├── mapOnly(keys, mapFn, callback)     // map/flatMap without reduce
  └── (reduceByKey, groupByKey via mr.exec with different configs)
```

## Implementation Phases

### Phase 1: Narrow Transformations (map, flatMap, filter)

- **map** / **flatMap**: Already supported by `mr.exec`—mapper returns array of `{key: value}`.
- **filter**: Map returns `[]` or `[{[key]: value}]` based on predicate. Use compact to drop empty. Or: map returns `[]` for filtered-out, `[{[key]: value}]` for kept; compact filters out keys with empty value arrays.
- **mapOnly**: For operations that don't need reduce (e.g., map then collect), use reduce that passes through: `(k, vals) => ({[k]: vals[0]})` for single value, or concatenate for flatMap.

### Phase 2: Wide Transformations (distinct, reduceByKey, groupByKey)

- **distinct**: Map `(k, v) => [{[k]: k}]` (keep key only). Reduce `(k, vals) => ({[k]: vals[0]})`. Dedupes by key.
- **reduceByKey**: Direct use of `mr.exec` with user map and reduce.
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
- **sortByKey**: Shuffle with order-preserving partitioner; merge-sort across partitions.

## Key Files

| File | Purpose |
|------|---------|
| `distribution/all/spark.js` | New spark service |
| `distribution/all/all.js` | Register spark service |
| `distribution.js` | Wire spark into groups (via all.js) |
| `t6.js` | Manual test script |

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
