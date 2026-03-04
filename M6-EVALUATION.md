# M6 Evaluation: Assignment, Spec, and Implementation

## 1. How Substantial Is the Assignment?

### Current State

| Dimension | Assessment | Notes |
|-----------|------------|-------|
| **Scope** | Substantial | 19 operations across transformations, actions, set ops, joins |
| **Technical depth** | Moderate | Most ops map directly to `mr.exec`; serialization and fusion add complexity |
| **Design freedom** | Good | Spec allows flexibility in API shape, partitioning, lazy vs eager |
| **M5 improvement** | Clear | Higher-level abstractions, fluent API, multi-dataset ops |

### Substantiality Score: **7/10**

**What makes it substantial:**
- Fluent API with lazy evaluation and pipeline fusion requires non-trivial design
- Function serialization (`util.compile` + `eval`) is a real distributed-systems challenge
- Multi-dataset operations (union, intersection, join) require coordinating two key sets
- 19 operations is a large surface area

**What keeps it from being harder:**
- Many operations are thin wrappers over `mr.exec` (distinct, groupByKey, collect)
- Set operations and joins use orchestrator-side logic (filter keys, then collect both)
- `sortByKey` is collect-then-sort, not distributed
- Single-store assumption simplifies join/set ops
- No partitioning strategy choices; students use whatever M5 provides

---

## 2. Spec Evaluation

### Strengths

- **Clear scope** – Operations are well-defined without over-specifying implementation
- **Design freedom** – "You have freedom over" API shape, lazy vs eager, partitioning
- **Substantial requirements** – Fluent API, lazy eval, fusion, serialization are outcome-focused
- **Fluent API guidance** – Shows intended style without prescribing exact code
- **References** – Spark RDD guide and M5 files give good context

### Weaknesses

- **Single-store implicit** – Join/union/intersection/subtract assume same store; cross-group case is not mentioned
- **sortByKey underspecified** – No indication that distributed sort is desirable
- **distinct ambiguity** – "Duplicate keys (or key-value pairs)" leaves semantics open
- **No difficulty gradient** – All operations presented as equal; no "stretch" or "extra credit" tier

---

## 3. Implementation Evaluation

### Strengths

- **Complete** – All 19 operations implemented
- **Fluent API** – Lazy RDD with map/filter/flatMap, fusion for consecutive map/filter
- **Serialization** – `util.compile` used for map, filter, flatMap, foreach, reduceByKey
- **Composition** – intersection → distinct, reduce → collect, rightOuterJoin → leftOuterJoin
- **Modular** – Spark is a separate service; no changes to `mr.js`

### Weaknesses

- **Orchestrator bottleneck** – reduce, join, leftOuterJoin, rightOuterJoin, sortByKey all pull full data to orchestrator
- **flatMap fusion** – flatMap runs on orchestrator after prior ops; no distributed flatMap in pipeline
- **flatMap + more ops** – "flatMap followed by more ops not yet supported"
- **Error handling** – Worker errors in `mr.js` are swallowed; users can get empty results
- **distinct** – By key only; no distinct by (key, value)

---

## 4. Improvements to Make the Assignment More Difficult

### Tier 1: Moderate Increase in Difficulty

| Improvement | Description | Why it's harder |
|-------------|-------------|-----------------|
| **Distributed sortByKey** | Range partitioner + merge-sort across partitions | Requires partitioning strategy, ordering guarantees, multi-phase MR |
| **Error propagation** | Surface worker errors to the user | Requires changing `mr.js` or adding error aggregation in spark |
| **distinct by (key, value)** | Support both distinct-by-key and distinct-by-pair | Requires hashing or serializing (key, value) for deduplication |

### Tier 2: Significant Increase in Difficulty

| Improvement | Description | Why it's harder |
|-------------|-------------|-----------------|
| **Cross-group join** | `join(groupA, keysA, groupB, keysB)` with different stores | Multi-group coordination, cross-node data movement, key alignment |
| **Distributed flatMap in pipeline** | Fuse flatMap with prior map/filter; run on workers | flatMap emits multiple items per input; need to handle in reduce or second MR |
| **flatMap followed by more ops** | Support `.flatMap().map().filter().collect()` | Requires materializing flatMap output (temp store/mem) for next stage |
| **cogroup** | Group values from 2+ datasets by key | Foundation for join; more general than join |

### Tier 3: Stretch / Extra Credit

| Improvement | Description | Why it's harder |
|-------------|-------------|-----------------|
| **fullOuterJoin** | All keys from both datasets | Combines left and right outer join logic |
| **persist / cache** | Materialize RDD to store for reuse | Requires output groups, lifecycle management |
| **Range partitioner** | User-specified partitioner for shuffle | Plugs into mr; affects sortByKey, join, groupByKey |
| **Performance benchmark** | Report throughput/latency for key operations | Adds testing and measurement requirements |

---

## 5. Recommended Spec Changes to Increase Difficulty

### Option A: Add a "Stretch" Section

Add to the spec:

```
## Stretch Goals (Optional)

- **Distributed sortByKey**: Sort across partitions using a range partitioner; merge results.
- **Cross-group join**: Join datasets from two different groups/stores.
- **flatMap in fluent pipeline**: Support `.flatMap().map().collect()` with flatMap running on workers.
```

### Option B: Elevate One Requirement

Promote **distributed sortByKey** from "nice to have" to required:

- Current: sortByKey can be collect + local sort
- New: "sortByKey must use a distributed algorithm (e.g., range partitioner + merge-sort) when the dataset exceeds a threshold"

### Option C: Add a "Correctness" Requirement

Require **error propagation**:

- "Worker failures or exceptions in user functions must be reported to the caller rather than producing empty or partial results."

---

## 6. Summary

| Aspect | Rating | Notes |
|--------|--------|-------|
| **Substantiality** | 7/10 | Solid scope; fusion and serialization add depth; many ops are thin wrappers |
| **Spec quality** | Strong | Clear, flexible; could add stretch goals and clarify distinct/sortByKey |
| **Implementation** | Complete | All ops, fluent API, fusion; orchestrator bottleneck and flatMap limits remain |
| **Difficulty ceiling** | Moderate | Room to grow via distributed sort, cross-group ops, full pipeline fusion |

### Verdict

The assignment is **substantial enough** for a typical course milestone: it requires design (fluent API, lazy eval), implementation (serialization, fusion), and integration (19 ops over M5). To make it **more difficult**, the most impactful additions would be:

1. **Distributed sortByKey** – Teaches partitioning and ordering
2. **Cross-group join** – Teaches multi-group coordination
3. **Error propagation** – Teaches robustness and debugging
4. **flatMap in pipeline** – Completes the fluent API story

Consider adding 1–2 of these as stretch goals or optional requirements rather than mandating all of them.
