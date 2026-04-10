# M6 milestone utilities

Scripts and notes for the Spark-style milestone live here so the repository root stays small.

| Item | Purpose |
|------|---------|
| `t6.js` | Manual Spark integration tests |
| `s6.js` | Fluent API demo |
| `p6.js` | Performance benchmark driver (writes `p6-results.html` at the repository root) |
| `p6-html.js` | HTML report for the benchmark |
| `generate-capstone-expected.js` | Regenerate `assignment/m6-capstone/expected.json` (instructor / CI) |
| `check-capstone.js` | Compare student capstone JSON to `expected.json` |
| `M6-IMPLEMENTATION.md`, `M6-EVALUATION.md` | Design / evaluation notes |

Run manual scripts via the shared wrapper (frees ports, applies timeout):

```bash
./scripts/run-test.sh m6/t6.js
./scripts/run-test.sh m6/s6.js
TIMEOUT=600 ./scripts/run-test.sh m6/p6.js
```

The assignment handout and capstone dataset are under `assignment/` (see `assignment/README.md`).
