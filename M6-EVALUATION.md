# M6 Evaluation: Assignment, Spec, and Implementation

## 1. How Substantial Is the Assignment?

### Assessment

| Dimension | Assessment | Notes |
|-----------|------------|-------|
| **Scope** | Substantial | Many operations across transformations, actions, set ops, joins |
| **Technical depth** | Moderate–strong | Serialization, fusion, distributed sort, join coordination, error paths |
| **Design freedom** | Good | Spec allows API shape, partitioning, lazy vs eager |
| **M5 improvement** | Clear | Fluent layer over MapReduce + store |

### Substantiality Score: **7–8/10**

**What makes it substantial:**

- Fluent API with lazy evaluation and **fusion** for narrow chains
- **Function serialization** (`util.compile` + `eval`) for remote execution
- **Multi-dataset** coordination (union, intersection, joins)
- **Distributed `sortByKey`** (range partitions + per-partition sort + merge) and **single-pass union-key strategy** for joins reduce redundant work versus naive double-collect
- **Distributed fluent flatMap** (full pipeline in one MR when flatMap is present)
- **Error propagation** in `mr.js` for map/reduce and **store.get** failures

**What still limits difficulty:**

- **`mr.exec`** still returns full result vectors to the orchestrator per job (`collect` is O(output) on the driver)
- Dataset-wide **`reduce`** remains collect-then-fold for arbitrary binary ops
- **Set ops** still use orchestrator-side `Set` membership for key lists (same asymptotic as before; intersection/subtract are not multi-round shuffle joins)
- Single-group / single-store assumption for joins unless extended

---

## 2. Spec Evaluation

### Strengths

- **Clear scope** – Operations are well-defined without over-specifying implementation
- **Design freedom** – API shape, lazy vs eager, partitioning
- **Substantial requirements** – Fluent API, lazy eval, fusion, serialization
- **Fluent API guidance** – Intended style without prescribing exact code
- **References** – Spark RDD guide and M5 files

### Weaknesses

- **Single-store implicit** – Join/union/intersection/subtract assume one store; cross-group case is optional elsewhere
- **distinct ambiguity** – Duplicate key vs pair semantics left open (implementation supports both via `byPair`)
- **No difficulty gradient** in the core spec – stretch items listed separately in spec notes

---

## 3. Implementation Evaluation (current)

### Strengths

- **Complete surface** – Operations from the spec (transformations, actions, sets, joins, `sortByKey`, `foreach`, `reduceByKey`, fluent API).
- **Fluent API** – Lazy RDD; **map/filter fused**; **flatMap + suffix** compiled into **one** `mr.exec` where applicable.
- **Serialization** – `util.compile` for narrow ops, flatMap chains, `reduceByKey`, **`sortByKey` reduce** (fixes closure loss on workers for sort order).
- **Joins** – **Single MR read** over deduped union of keys (`unionUniqueKeys`) instead of two full collects; semantics aligned with one value per store key.
- **`sortByKey`** – **Always distributed** (range buckets + local sort + merge); `distributedSortThreshold` kept only for API compatibility.
- **Errors** – `workerMap` / `workerReduce` surface user failures; **`store.get` errors** no longer silently drop keys.
- **Benchmark (`p6.js`)** – Quiet by default; **`_disableLogs`** on spawned nodes; **`P6_OP_TIMEOUT_MS`**; **`P6_VERBOSE`**; HTML charts with **markers** so sparse series render; **`scripts/kill-ports.sh`** covers more ports.

### Remaining tradeoffs

- **Orchestrator** still aggregates full MR outputs; **collect** and large results remain driver-sized.
- **Left outer row order** follows **`keysA`** order, not necessarily legacy `collect(keysA)` iteration order (tests check counts and nulls, not order).
- **Optional extensions** (fullOuterJoin, cogroup, cross-group join, persist) not implemented unless added later.

---

## 4. Improvements to Make the Assignment More Difficult

### Tier 1: Moderate increase

| Improvement | Status in this codebase |
|-------------|-------------------------|
| **Distributed sortByKey** | **Implemented** (always-on distributed path + compiled reduce) |
| **Error propagation** | **Implemented** (map/reduce + store.get) |
| **distinct by (key, value)** | **Implemented** (`opts.byPair`) |

### Tier 2: Significant increase

| Improvement | Notes |
|-------------|--------|
| **Cross-group join** | Not implemented; requires multi-group wiring |
| **Persist / cache** | Not implemented |
| **Streaming collect / paged mr.exec** | Not implemented |

### Tier 3: Stretch / extra credit

| Improvement | Notes |
|-------------|--------|
| **fullOuterJoin**, **cogroup**, **range partitioner API** | Optional spec items |
| **Performance script** | **p6.js** + `p6-results.html` satisfies measurement/reporting |

---

## 5. Recommended Spec Changes (optional course tweaks)

- Add an explicit **“driver memory”** note: `collect` and MR result size scale with data returned.
- List **error propagation** as a core correctness requirement (this implementation aligns with that).
- Keep **stretch** section for cross-group ops and advanced caching.

---

## 6. Summary

| Aspect | Rating | Notes |
|--------|--------|-------|
| **Substantiality** | 7–8/10 | Broad API; distributed sort, fused flatMap, join and error improvements add depth |
| **Spec quality** | Strong | Flexible; could spell out driver O(n) for collect |
| **Implementation** | Strong | Full op set, fusion, distributed sort + flatMap pipeline, union-key joins, MR errors + store errors, benchmark hardening |
| **Difficulty ceiling** | Moderate–high for a course milestone | Room remains for streaming, cross-store joins, persistence |

### Verdict

The milestone remains **substantial** for typical coursework: design (fluent API, lazy eval), implementation (serialization, fusion, distributed algorithms), and integration (Spark service over M5). The **current implementation** closes several gaps called out in earlier drafts: **distributed `sortByKey`**, **error propagation including store reads**, **distributed fluent flatMap + suffix**, **more efficient joins**, and a **robust `p6.js`** workflow. Further difficulty would come from **cross-group data**, **streaming APIs**, and **fault tolerance**—beyond the original spec’s non-goals.
