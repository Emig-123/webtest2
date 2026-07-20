// Shared chart utilities: Chart.js defaults, color tokens, tooltip styling,
// table-view toggles, and small formatting helpers used by both dashboards.
(function (global) {
  "use strict";

  function cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  function tokens() {
    return {
      inkPrimary: cssVar("--ink-primary"),
      inkSecondary: cssVar("--ink-secondary"),
      inkMuted: cssVar("--ink-muted"),
      surface: cssVar("--surface-raised"),
      border: cssVar("--border-strong"),
      gridline: cssVar("--gridline"),
      baseline: cssVar("--baseline"),
      accent: cssVar("--accent"),
      series: [
        cssVar("--series-1"), cssVar("--series-2"), cssVar("--series-3"), cssVar("--series-4"),
        cssVar("--series-5"), cssVar("--series-6"), cssVar("--series-7"), cssVar("--series-8")
      ],
      seq: [
        cssVar("--seq-100"), cssVar("--seq-150"), cssVar("--seq-200"), cssVar("--seq-250"),
        cssVar("--seq-300"), cssVar("--seq-350"), cssVar("--seq-400"), cssVar("--seq-450"),
        cssVar("--seq-500"), cssVar("--seq-550"), cssVar("--seq-600"), cssVar("--seq-650"), cssVar("--seq-700")
      ]
    };
  }

  // Pick N evenly spaced steps from the sequential ramp for an ORDINAL encoding
  // (categories whose order carries meaning: income brackets, education levels).
  // Light end clears the >=2:1 contrast floor (never lighter than step 250 => index 3).
  function ordinalRamp(n, mode) {
    mode = mode || "light";
    var t = tokens();
    var usable = t.seq.slice(3); // start at step 250
    if (n <= 1) return [usable[usable.length - 1]];
    var out = [];
    for (var i = 0; i < n; i++) {
      var pos = i / (n - 1);
      var idx = Math.round(pos * (usable.length - 1));
      out.push(usable[idx]);
    }
    return out;
  }

  // Pick a step from the sequential ramp for magnitude t in [0,1].
  function sequentialColor(t) {
    var t2 = tokens();
    var clamped = Math.max(0, Math.min(1, t));
    var idx = Math.round(clamped * (t2.seq.length - 1));
    return t2.seq[idx];
  }

  function relLuminance(hex) {
    var h = hex.replace("#", "");
    if (h.length === 3) h = h.split("").map(function (c) { return c + c; }).join("");
    var chans = [0, 2, 4].map(function (i) {
      var c = parseInt(h.substring(i, i + 2), 16) / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * chans[0] + 0.7152 * chans[1] + 0.0722 * chans[2];
  }

  function contrastRatio(hexA, hexB) {
    var la = relLuminance(hexA), lb = relLuminance(hexB);
    var lighter = Math.max(la, lb), darker = Math.min(la, lb);
    return (lighter + 0.05) / (darker + 0.05);
  }

  // Pick black or white text — whichever clears more contrast against the fill.
  function textOnFill(hex) {
    var white = "#ffffff", black = "#0b0b0b";
    return contrastRatio(hex, white) >= contrastRatio(hex, black) ? white : black;
  }

  function hexToRgba(hex, alpha) {
    var h = hex.replace("#", "");
    if (h.length === 3) h = h.split("").map(function (c) { return c + c; }).join("");
    var r = parseInt(h.substring(0, 2), 16);
    var g = parseInt(h.substring(2, 4), 16);
    var b = parseInt(h.substring(4, 6), 16);
    return "rgba(" + r + "," + g + "," + b + "," + alpha + ")";
  }

  function formatPct(x, decimals) {
    if (x === null || x === undefined || isNaN(x)) return "—";
    return (x * 100).toFixed(decimals === undefined ? 0 : decimals) + "%";
  }

  function formatNum(x, decimals) {
    if (x === null || x === undefined || isNaN(x)) return "—";
    return Number(x).toLocaleString(undefined, {
      minimumFractionDigits: decimals || 0,
      maximumFractionDigits: decimals === undefined ? 1 : decimals
    });
  }

  function formatCompact(x) {
    if (x === null || x === undefined || isNaN(x)) return "—";
    return Number(x).toLocaleString(undefined, { notation: "compact", maximumFractionDigits: 1 });
  }

  // ---- Chart.js global defaults --------------------------------------------
  function applyChartDefaults() {
    if (!global.Chart) return;
    var t = tokens();
    var C = global.Chart;
    C.defaults.font.family = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
    C.defaults.font.size = 12;
    C.defaults.color = t.inkSecondary;
    C.defaults.borderColor = t.gridline;
    C.defaults.plugins.legend.display = false; // we build our own legends in HTML
    C.defaults.plugins.tooltip.enabled = true;
    C.defaults.plugins.tooltip.backgroundColor = t.surface;
    C.defaults.plugins.tooltip.titleColor = t.inkPrimary;
    C.defaults.plugins.tooltip.bodyColor = t.inkPrimary;
    C.defaults.plugins.tooltip.borderColor = t.border;
    C.defaults.plugins.tooltip.borderWidth = 1;
    C.defaults.plugins.tooltip.padding = 10;
    C.defaults.plugins.tooltip.cornerRadius = 8;
    C.defaults.plugins.tooltip.titleFont = { weight: "700", size: 12 };
    C.defaults.plugins.tooltip.bodyFont = { size: 12 };
    C.defaults.plugins.tooltip.usePointStyle = true;
    C.defaults.plugins.tooltip.boxPadding = 4;
    C.defaults.plugins.tooltip.caretSize = 5;
    C.defaults.elements.line.borderWidth = 2;
    C.defaults.elements.line.tension = 0.25;
    C.defaults.elements.point.radius = 4;
    C.defaults.elements.point.hoverRadius = 6;
    C.defaults.elements.point.hitRadius = 12;
    C.defaults.elements.bar.borderRadius = 4;
    C.defaults.elements.bar.borderSkipped = "bottom";
    C.defaults.maintainAspectRatio = false;
    C.defaults.animation.duration = matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 500;
  }

  // Vertical crosshair for line charts: draws a hairline at the active tooltip X.
  var crosshairPlugin = {
    id: "crosshair",
    afterDraw: function (chart) {
      if (chart.tooltip && chart.tooltip._active && chart.tooltip._active.length) {
        var x = chart.tooltip._active[0].element.x;
        var yScale = chart.scales.y;
        var ctx = chart.ctx;
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(x, yScale.top);
        ctx.lineTo(x, yScale.bottom);
        ctx.lineWidth = 1;
        ctx.strokeStyle = tokens().baseline;
        ctx.stroke();
        ctx.restore();
      }
    }
  };

  function baseGridOptions() {
    var t = tokens();
    return {
      grid: { color: t.gridline, drawTicks: false, tickLength: 8 },
      border: { color: t.baseline },
      ticks: { color: t.inkMuted, padding: 6 }
    };
  }

  // ---- Table-view toggle -----------------------------------------------------
  // Wires a "View as table" button to swap between a chart canvas wrapper and
  // an accessible HTML table built from the same data.
  function wireTableToggle(btn, canvasWrap, tableWrap) {
    btn.addEventListener("click", function () {
      var showingTable = btn.getAttribute("aria-pressed") === "true";
      var next = !showingTable;
      btn.setAttribute("aria-pressed", String(next));
      btn.textContent = next ? "View chart" : "View as table";
      canvasWrap.hidden = next;
      tableWrap.hidden = !next;
    });
  }

  function buildTable(container, caption, columns, rows) {
    container.innerHTML = "";
    var wrap = document.createElement("div");
    wrap.className = "chart-data-table-wrap";
    var table = document.createElement("table");
    table.className = "chart-data-table";

    var cap = document.createElement("caption");
    cap.textContent = caption;
    table.appendChild(cap);

    var thead = document.createElement("thead");
    var headRow = document.createElement("tr");
    columns.forEach(function (c) {
      var th = document.createElement("th");
      th.scope = "col";
      th.textContent = c;
      headRow.appendChild(th);
    });
    thead.appendChild(headRow);
    table.appendChild(thead);

    var tbody = document.createElement("tbody");
    rows.forEach(function (r) {
      var tr = document.createElement("tr");
      r.forEach(function (cell) {
        var td = document.createElement("td");
        td.textContent = cell;
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    wrap.appendChild(table);
    container.appendChild(wrap);
  }

  function legendItem(color, label, shape) {
    var span = document.createElement("span");
    span.className = "chart-legend-item";
    var key = document.createElement("span");
    key.className = shape === "dot" ? "chart-legend-dot" : "chart-legend-key";
    key.style.background = color;
    var text = document.createElement("span");
    text.textContent = label;
    span.appendChild(key);
    span.appendChild(text);
    return span;
  }

  function buildLegend(container, items, shape) {
    container.innerHTML = "";
    items.forEach(function (it) {
      container.appendChild(legendItem(it.color, it.label, shape));
    });
  }

  function skeletonize(el, on) {
    if (on) {
      el.classList.add("skeleton");
      el.setAttribute("aria-busy", "true");
    } else {
      el.classList.remove("skeleton");
      el.removeAttribute("aria-busy");
    }
  }

  global.Viz = {
    tokens: tokens,
    ordinalRamp: ordinalRamp,
    sequentialColor: sequentialColor,
    textOnFill: textOnFill,
    contrastRatio: contrastRatio,
    hexToRgba: hexToRgba,
    formatPct: formatPct,
    formatNum: formatNum,
    formatCompact: formatCompact,
    applyChartDefaults: applyChartDefaults,
    crosshairPlugin: crosshairPlugin,
    baseGridOptions: baseGridOptions,
    wireTableToggle: wireTableToggle,
    buildTable: buildTable,
    buildLegend: buildLegend,
    skeletonize: skeletonize
  };
})(window);
