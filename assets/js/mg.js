(function () {
  "use strict";

  var DATA_PATH = "../assets/data/mg_baseline_scenario.json";

  var els = {};
  var scenario = null;
  var showing3d = false;
  var morphT = 0; // 0 = flat grid, 1 = fully isometric 3D
  var morphRaf = null;

  function $(id) { return document.getElementById(id); }

  function cacheEls() {
    ["scenarioBadge", "scenarioNote",
     "kpiNet", "kpiRoll", "kpiDelivery", "kpiProfitShare",
     "statSpot", "statFutures", "statReturn", "statSpread", "statVol", "statLar",
     "heatmapWrap", "heatmapAxisRow", "heatmapRowAxis", "heatmapGrid",
     "heatmapTableToggle", "heatmapTableWrap",
     "toggle3d", "mg3dWrap", "mg3dCanvas"
    ].forEach(function (id) { els[id] = $(id); });
  }

  function fetchJson(path) {
    return fetch(path).then(function (r) {
      if (!r.ok) throw new Error("Failed to load " + path + " (" + r.status + ")");
      return r.json();
    });
  }

  function fmtMoney(x) {
    if (x === null || x === undefined || isNaN(x)) return "—";
    var sign = x < 0 ? "-" : "";
    return sign + "$" + Math.abs(x).toLocaleString(undefined, { notation: "compact", maximumFractionDigits: 1 });
  }

  function fmtMoneyFull(x) {
    if (x === null || x === undefined || isNaN(x)) return "—";
    var sign = x < 0 ? "-" : "";
    return sign + "$" + Math.abs(x).toLocaleString(undefined, { maximumFractionDigits: 0 });
  }

  // ---- KPIs & strategy summary -----------------------------------------------
  function renderKpis() {
    var m = scenario.monthly, s = scenario.summary, c = scenario.constants;

    Viz.skeletonize(els.kpiNet, false);
    Viz.skeletonize(els.kpiRoll, false);
    Viz.skeletonize(els.kpiDelivery, false);
    Viz.skeletonize(els.kpiProfitShare, false);

    els.kpiNet.textContent = fmtMoney(m.netTotalPnL);
    els.kpiNet.className = "stat-value " + (m.netTotalPnL >= 0 ? "" : "");
    els.kpiRoll.textContent = fmtMoney(m.totalRollPnL);
    els.kpiDelivery.textContent = fmtMoney(m.totalDeliveryPnL);
    els.kpiProfitShare.textContent = Viz.formatPct(s.profitableShare, 0);

    els.statSpot.textContent = "$" + c.spot.toFixed(2);
    els.statFutures.textContent = "$" + c.nextFuturesPrice.toFixed(2);
    els.statReturn.textContent = Viz.formatPct(c.monthlyReturn, 2);
    els.statSpread.textContent = "$" + m.backwardationSpread.toFixed(2) + "/bbl";
    els.statVol.textContent = c.volatility.toFixed(2);
    els.statLar.textContent = fmtMoney(c.lar);
  }

  function renderScenarioBadge() {
    els.scenarioBadge.innerHTML = '<span class="dot" aria-hidden="true"></span><span>Scenario: <strong>' +
      scenario.meta.scenarioName + '</strong></span>';
    els.scenarioNote.textContent = scenario.meta.note;
  }

  // ---- Sensitivity heatmap ----------------------------------------------------
  function renderHeatmapAxes() {
    els.heatmapAxisRow.innerHTML = "";
    scenario.sensitivity.prices.forEach(function (p) {
      var span = document.createElement("span");
      span.textContent = "$" + p.toFixed(1);
      els.heatmapAxisRow.appendChild(span);
    });
    els.heatmapRowAxis.innerHTML = "";
    scenario.sensitivity.rows.forEach(function (row) {
      var span = document.createElement("span");
      span.textContent = row.h.toFixed(2);
      els.heatmapRowAxis.appendChild(span);
    });
  }

  function renderHeatmapGrid() {
    var maxAbs = Math.max(Math.abs(scenario.summary.min), Math.abs(scenario.summary.max)) || 1;
    els.heatmapGrid.classList.remove("skeleton");
    els.heatmapGrid.innerHTML = "";
    els.heatmapGrid.setAttribute("role", "img");
    els.heatmapGrid.setAttribute("aria-label",
      "Sensitivity heatmap of net profit and loss across " + scenario.sensitivity.rows.length +
      " hedge ratios (0.05 to 1.00) and " + scenario.sensitivity.prices.length +
      " futures prices ($75 to $85). " + Viz.formatPct(scenario.summary.profitableShare, 0) +
      " of the " + (scenario.sensitivity.rows.length * scenario.sensitivity.prices.length) +
      " scenarios are profitable. Use \"View as table\" for the exact value of every cell.");

    scenario.sensitivity.rows.forEach(function (row) {
      row.cells.forEach(function (cell) {
        var tile = document.createElement("div");
        tile.className = "heat-tile";
        tile.setAttribute("aria-hidden", "true");
        var color = Viz.divergingColor(cell.value / maxAbs);
        tile.style.background = color;
        tile.style.color = Viz.textOnFill(color);
        tile.style.borderColor = "transparent";
        var value = document.createElement("span");
        value.className = "heat-value";
        value.textContent = fmtMoney(cell.value);
        tile.appendChild(value);
        els.heatmapGrid.appendChild(tile);
      });
    });
  }

  function renderHeatmapTable() {
    var container = els.heatmapTableWrap;
    container.innerHTML = "";
    var wrap = document.createElement("div");
    wrap.className = "chart-data-table-wrap";
    var table = document.createElement("table");
    table.className = "chart-data-table";

    var cap = document.createElement("caption");
    cap.textContent = "Net profit/loss ($) by hedge ratio and futures price — " + scenario.meta.scenarioName;
    table.appendChild(cap);

    var thead = document.createElement("thead");
    var headRow = document.createElement("tr");
    var corner = document.createElement("th");
    corner.scope = "col";
    corner.textContent = "Hedge ratio \\ Price";
    headRow.appendChild(corner);
    scenario.sensitivity.prices.forEach(function (p) {
      var th = document.createElement("th");
      th.scope = "col";
      th.textContent = "$" + p.toFixed(1);
      headRow.appendChild(th);
    });
    thead.appendChild(headRow);
    table.appendChild(thead);

    var tbody = document.createElement("tbody");
    scenario.sensitivity.rows.forEach(function (row) {
      var tr = document.createElement("tr");
      var rowTh = document.createElement("th");
      rowTh.scope = "row";
      rowTh.textContent = row.h.toFixed(2);
      tr.appendChild(rowTh);
      row.cells.forEach(function (cell) {
        var td = document.createElement("td");
        td.textContent = fmtMoneyFull(cell.value);
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    wrap.appendChild(table);
    container.appendChild(wrap);
  }

  // ---- 3D isometric surface (canvas) -------------------------------------------
  function drawSurface(t) {
    var canvas = els.mg3dCanvas;
    var ctx = canvas.getContext("2d");
    var dpr = window.devicePixelRatio || 1;
    var cssW = canvas.clientWidth, cssH = canvas.clientHeight;
    if (canvas.width !== cssW * dpr || canvas.height !== cssH * dpr) {
      canvas.width = cssW * dpr;
      canvas.height = cssH * dpr;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);

    var rows = scenario.sensitivity.rows;
    var nRows = rows.length, nCols = scenario.sensitivity.prices.length;
    var maxAbs = Math.max(Math.abs(scenario.summary.min), Math.abs(scenario.summary.max)) || 1;

    var flatCell = Math.min((cssW - 40) / nCols, (cssH - 60) / nRows, 16);
    var flatOriginX = (cssW - nCols * flatCell) / 2;
    var flatOriginY = 20;

    var isoCell = Math.min(cssW / (nCols + nRows), 14);
    var maxBarHeight = cssH * 0.55;
    var isoOriginX = cssW / 2;
    var isoOriginY = cssH - 30 - (nRows * isoCell) / 2;

    // Build a flat list of cells with depth key (r + c) for back-to-front painting.
    var items = [];
    rows.forEach(function (row, r) {
      row.cells.forEach(function (cell, c) {
        items.push({ r: r, c: c, value: cell.value });
      });
    });
    items.sort(function (a, b) { return (a.r + a.c) - (b.r + b.c); });

    items.forEach(function (item) {
      var r = item.r, c = item.c, value = item.value;
      var flatX = flatOriginX + c * flatCell;
      var flatY = flatOriginY + r * flatCell;

      var isoX = isoOriginX + (c - r) * (isoCell / 2);
      var isoYBase = isoOriginY + (c + r) * (isoCell / 4);
      var norm = value / maxAbs;
      var barH = maxBarHeight * Math.min(1, Math.abs(norm)) * t;

      var x = flatX + (isoX - flatX) * t;
      var yBase = flatY + (isoYBase - flatY) * t;
      var size = flatCell + (isoCell - flatCell) * t;
      var yTop = yBase - barH;

      var color = Viz.divergingColor(norm);

      // Top face.
      ctx.fillStyle = color;
      ctx.fillRect(x, yTop, size, size);

      // Side face for depth once the surface has risen (skip at t=0, flat).
      if (barH > 0.5) {
        ctx.fillStyle = Viz.hexToRgba(color, 0.55);
        ctx.fillRect(x, yTop + size, size, barH);
      }

      ctx.strokeStyle = Viz.hexToRgba(Viz.tokens().inkPrimary, 0.08);
      ctx.strokeRect(x, yTop, size, size + (barH > 0.5 ? barH : 0));
    });
  }

  function animateMorph(target) {
    if (morphRaf) cancelAnimationFrame(morphRaf);
    var reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
      morphT = target;
      drawSurface(morphT);
      return;
    }
    var start = morphT, startTime = null, duration = 550;
    function step(ts) {
      if (startTime === null) startTime = ts;
      var p = Math.min(1, (ts - startTime) / duration);
      var eased = 1 - Math.pow(1 - p, 3);
      morphT = start + (target - start) * eased;
      drawSurface(morphT);
      if (p < 1) morphRaf = requestAnimationFrame(step);
    }
    morphRaf = requestAnimationFrame(step);
  }

  function wire3dToggle() {
    els.toggle3d.addEventListener("click", function () {
      showing3d = !showing3d;
      els.toggle3d.setAttribute("aria-pressed", String(showing3d));
      els.toggle3d.textContent = showing3d ? "Hide 3D view" : "Show 3D view";
      els.mg3dWrap.hidden = false;
      animateMorph(showing3d ? 1 : 0);
      if (!showing3d) {
        window.setTimeout(function () {
          if (!showing3d) els.mg3dWrap.hidden = true;
        }, matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 600);
      }
    });
    window.addEventListener("resize", function () {
      if (!els.mg3dWrap.hidden) drawSurface(morphT);
    });
  }

  // ---- Wiring -----------------------------------------------------------------
  function renderAll() {
    renderScenarioBadge();
    renderKpis();
    renderHeatmapAxes();
    renderHeatmapGrid();
    renderHeatmapTable();
  }

  function init() {
    cacheEls();
    Viz.applyChartDefaults();

    fetchJson(DATA_PATH).then(function (data) {
      scenario = MGEngine.buildScenario(data);
      renderAll();
      Viz.wireTableToggle(els.heatmapTableToggle, els.heatmapWrap, els.heatmapTableWrap);
      wire3dToggle();
      els.mg3dWrap.hidden = true;
    }).catch(function (err) {
      console.error(err);
      [els.heatmapGrid, els.kpiNet, els.kpiRoll, els.kpiDelivery, els.kpiProfitShare].forEach(function (el) {
        if (!el) return;
        el.classList.remove("skeleton");
        el.innerHTML = '<span class="error-state">Could not load simulation data.</span>';
      });
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
