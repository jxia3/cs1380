/**
 * HTML report for m6/p6.js performance benchmark (SVG charts + raw table).
 */

const P6_OPS = [
  "collect", "count", "map+collect", "filter+collect", "flatMap+collect",
  "reduceByKey", "groupByKey", "distinct", "sortByKey", "join", "leftOuterJoin", "union",
];

const COLORS = ["#2563eb", "#16a34a", "#dc2626", "#9333ea"];

/**
 * @param {string} s
 * @returns {string}
 */
function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * @param {object} results - nested [workers][size][op] -> ms
 * @param {{ sizes: number[], nodeCounts: number[], runs: number }} opts
 * @returns {string}
 */
function generateP6Html(results, opts) {
  const SIZES = opts.sizes;
  const NODE_COUNTS = opts.nodeCounts;
  const RUNS = opts.runs;
  const ops = P6_OPS;

  const nodeColors = NODE_COUNTS.reduce((a, n, i) => ({...a, [n]: COLORS[i % COLORS.length]}), {});

  const w = 400;
  const h = 220;
  const pad = {left: 50, right: 20, top: 20, bottom: 40};
  const plotW = w - pad.left - pad.right;
  const plotH = h - pad.top - pad.bottom;

  function scaleX(x, min, max) {
    return pad.left + (x - min) / (max - min || 1) * plotW;
  }
  function scaleY(y, min, max) {
    return pad.top + plotH - (y - min) / (max - min || 1) * plotH;
  }

  function lineChart(op, dataByNodes) {
    const sizes = SIZES.filter((s) => dataByNodes[NODE_COUNTS[0]]?.[s] != null);
    if (sizes.length === 0) return "";
    const minY = 0;
    const maxY = Math.max(...allVals, 1);
    const minX = Math.min(...sizes);
    const maxX = Math.max(...sizes);

    let svg = `<svg width="${w}" height="${h}" style="border:1px solid #e5e7eb;margin:4px;">`;
    svg += `<text x="${w / 2}" y="12" text-anchor="middle" font-size="11" font-weight="bold">${escapeHtml(op)}</text>`;
    svg += `<line x1="${pad.left}" y1="${pad.top}" x2="${pad.left}" y2="${pad.top + plotH}" stroke="#9ca3af" stroke-width="1"/>`;
    svg += `<line x1="${pad.left}" y1="${pad.top + plotH}" x2="${pad.left + plotW}" y2="${pad.top + plotH}" stroke="#9ca3af" stroke-width="1"/>`;

    NODE_COUNTS.forEach((nc) => {
      const pts = sizes.map((s) => {
        const v = dataByNodes[nc]?.[s];
        return v != null ? `${scaleX(s, minX, maxX)},${scaleY(v, minY, maxY)}` : null;
      }).filter(Boolean);
      if (pts.length > 1) {
        svg += `<polyline points="${pts.join(" ")}" fill="none" stroke="${nodeColors[nc]}" stroke-width="2"/>`;
      }
      if (pts.length >= 1) {
        pts.forEach((pt) => {
          const [cx, cy] = pt.split(",");
          svg += `<circle cx="${cx}" cy="${cy}" r="4" fill="${nodeColors[nc]}" stroke="#fff" stroke-width="1"/>`;
        });
      }
    });

    sizes.forEach((s) => {
      const x = scaleX(s, minX, maxX);
      svg += `<text x="${x}" y="${h - 5}" text-anchor="middle" font-size="9" fill="#6b7280">${s}</text>`;
    });
    svg += `<text x="${pad.left - 5}" y="${pad.top + 8}" text-anchor="end" font-size="9" fill="#6b7280">${maxY}ms</text>`;
    svg += `</svg>`;
    return svg;
  }

  function scalingChart() {
    const op = "collect";
    const dataByNodes = {};
    NODE_COUNTS.forEach((nc) => {
      dataByNodes[nc] = {};
      SIZES.forEach((s) => {
        const v = results[nc]?.[s]?.[op];
        if (v != null) dataByNodes[nc][s] = v;
      });
    });
    const sizes = SIZES.filter((s) => results[NODE_COUNTS[0]]?.[s]?.[op] != null);
    if (sizes.length === 0) return "";
    const allVals = NODE_COUNTS.flatMap((nc) => sizes.map((s) => results[nc]?.[s]?.[op]).filter(Boolean));
    const maxY = Math.max(...allVals, 1);
    const minX = Math.min(...sizes);
    const maxX = Math.max(...sizes);

    let svg = `<svg width="${w}" height="${h}" style="border:1px solid #e5e7eb;margin:4px;">`;
    svg += `<text x="${w / 2}" y="12" text-anchor="middle" font-size="11" font-weight="bold">Scaling: collect (latency vs size)</text>`;
    svg += `<line x1="${pad.left}" y1="${pad.top}" x2="${pad.left}" y2="${pad.top + plotH}" stroke="#9ca3af" stroke-width="1"/>`;
    svg += `<line x1="${pad.left}" y1="${pad.top + plotH}" x2="${pad.left + plotW}" y2="${pad.top + plotH}" stroke="#9ca3af" stroke-width="1"/>`;

    NODE_COUNTS.forEach((nc) => {
      const pts = sizes.map((s) => {
        const v = results[nc]?.[s]?.[op];
        return v != null ? `${scaleX(s, minX, maxX)},${scaleY(v, 0, maxY)}` : null;
      }).filter(Boolean);
      if (pts.length > 1) {
        svg += `<polyline points="${pts.join(" ")}" fill="none" stroke="${nodeColors[nc]}" stroke-width="2"/>`;
      }
      if (pts.length >= 1) {
        pts.forEach((pt) => {
          const [cx, cy] = pt.split(",");
          svg += `<circle cx="${cx}" cy="${cy}" r="4" fill="${nodeColors[nc]}" stroke="#fff" stroke-width="1"/>`;
        });
      }
    });

    sizes.forEach((s) => {
      const x = scaleX(s, minX, maxX);
      svg += `<text x="${x}" y="${h - 5}" text-anchor="middle" font-size="9" fill="#6b7280">${s}</text>`;
    });
    svg += `</svg>`;
    return svg;
  }

  const legend = NODE_COUNTS.map((nc) => `<span style="color:${nodeColors[nc]}">■</span> ${nc} worker(s)`).join(" &nbsp; ");

  let html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>M6 Performance Results</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 24px; background: #f9fafb; }
    h1 { color: #111827; }
    .meta { color: #6b7280; margin-bottom: 20px; }
    .chart-grid { display: flex; flex-wrap: wrap; gap: 8px; }
    .chart-section { margin: 20px 0; }
    .chart-section h2 { font-size: 14px; color: #374151; margin-bottom: 8px; }
    table { border-collapse: collapse; margin: 16px 0; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    th, td { padding: 10px 14px; text-align: right; }
    th { background: #f3f4f6; font-weight: 600; }
    td:first-child, th:first-child { text-align: left; }
    tr:nth-child(even) { background: #f9fafb; }
  </style>
</head>
<body>
  <h1>M6 Performance Benchmark</h1>
  <div class="meta">Sizes: ${SIZES.join(", ")} | Workers: ${NODE_COUNTS.join(", ")} | Runs: ${RUNS} | Legend: ${legend}</div>

  <div class="chart-section">
    <h2>Latency vs Dataset Size (by operation)</h2>
    <div class="chart-grid">`;

  ops.forEach((op) => {
    const fixed = {};
    NODE_COUNTS.forEach((nc) => {
      fixed[nc] = {};
      SIZES.forEach((s) => {
        const v = results[nc]?.[s]?.[op];
        if (v != null) fixed[nc][s] = v;
      });
    });
    html += lineChart(op, fixed);
  });

  html += `
    </div>
  </div>

  <div class="chart-section">
    <h2>Scaling: More Workers Reduce Latency</h2>
    <div class="chart-grid">
      ${scalingChart()}
    </div>
  </div>

  <div class="chart-section">
    <h2>Raw Data (ms)</h2>
    <table>
      <thead><tr><th>Workers</th><th>Size</th>${ops.map((o) => `<th>${escapeHtml(o)}</th>`).join("")}</tr></thead>
      <tbody>`;

  NODE_COUNTS.forEach((nc) => {
    SIZES.forEach((s) => {
      const row = results[nc]?.[s];
      if (row) {
        html += `<tr><td>${nc}</td><td>${s}</td>${ops.map((o) => `<td>${row[o] ?? "-"}</td>`).join("")}</tr>`;
      }
    });
  });

  html += `
      </tbody>
    </table>
  </div>
</body>
</html>`;

  return html;
}

module.exports = {
  P6_OPS,
  generateP6Html,
  escapeHtml,
};
