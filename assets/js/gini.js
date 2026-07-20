(function () {
  "use strict";

  var DATA_BASE = "../assets/data/";
  var els = {};
  var state = {
    panel: [],       // {code, year, gini, unemployment}
    countries: {},   // code -> {region, name}
    gdp: {},         // "code|year" -> value
    edu: {},         // "code|year" -> value
    yearsAvg: [],    // [{year, avg}]
    regionStats: [], // [{region, min, max, avg, count}]
    year: 2008,
    trendChart: null,
    gdpChart: null,
    eduChart: null
  };

  function $(id) { return document.getElementById(id); }

  function cacheEls() {
    ["yearSlider", "yearValue", "resetFilters", "kpiCount", "kpiAvg", "kpiRegion",
     "kpiYearLabel1", "kpiYearLabel2", "kpiRegionSub", "relYear",
     "trendChart", "trendCanvasWrap", "trendTableWrap", "trendTableToggle",
     "gdpChart", "gdpCanvasWrap", "gdpTableWrap", "gdpTableToggle", "gdpEmptyState",
     "eduChart", "eduCanvasWrap", "eduTableWrap", "eduTableToggle", "eduEmptyState",
     "regionChart", "regionTableWrap", "regionTableToggle"
    ].forEach(function (id) { els[id] = $(id); });
  }

  function fetchJson(path) {
    return fetch(path).then(function (r) {
      if (!r.ok) throw new Error("Failed to load " + path + " (" + r.status + ")");
      return r.json();
    });
  }

  function loadAll() {
    return Promise.all([
      fetchJson(DATA_BASE + "gini_panel.json"),
      fetchJson(DATA_BASE + "gini_countries.json"),
      fetchJson(DATA_BASE + "gini_gdp.json"),
      fetchJson(DATA_BASE + "gini_education.json")
    ]).then(function (results) {
      var panelRaw = results[0], countriesRaw = results[1], gdpRaw = results[2], eduRaw = results[3];

      state.panel = panelRaw.map(function (r) {
        return { code: r[0], year: r[1], gini: r[2], unemployment: r[3] };
      });

      countriesRaw.forEach(function (r) {
        state.countries[r[0]] = { region: r[1], name: r[2] };
      });

      gdpRaw.forEach(function (r) {
        state.gdp[r[0] + "|" + r[1]] = r[2];
      });
      eduRaw.forEach(function (r) {
        state.edu[r[0] + "|" + r[1]] = r[2];
      });

      computeYearlyAverages();
      computeRegionStats();
    });
  }

  function computeYearlyAverages() {
    var byYear = {};
    state.panel.forEach(function (r) {
      if (r.gini === null || r.gini === undefined) return;
      if (!byYear[r.year]) byYear[r.year] = { sum: 0, count: 0 };
      byYear[r.year].sum += r.gini;
      byYear[r.year].count += 1;
    });
    var years = Object.keys(byYear).map(Number).filter(function (y) { return y >= 1980 && y <= 2024; }).sort(function (a, b) { return a - b; });
    state.yearsAvg = years.map(function (y) {
      return { year: y, avg: byYear[y].sum / byYear[y].count, count: byYear[y].count };
    });
  }

  function computeRegionStats() {
    var byRegion = {};
    state.panel.forEach(function (r) {
      if (r.gini === null || r.gini === undefined) return;
      var c = state.countries[r.code];
      if (!c) return;
      var region = c.region;
      if (!byRegion[region]) byRegion[region] = { min: Infinity, max: -Infinity, sum: 0, count: 0 };
      var b = byRegion[region];
      b.min = Math.min(b.min, r.gini);
      b.max = Math.max(b.max, r.gini);
      b.sum += r.gini;
      b.count += 1;
    });
    state.regionStats = Object.keys(byRegion).map(function (region) {
      var b = byRegion[region];
      return { region: region, min: b.min, max: b.max, avg: b.sum / b.count, count: b.count };
    }).sort(function (a, b) { return b.avg - a.avg; });
  }

  // ---- KPIs -----------------------------------------------------------------
  function renderKpis() {
    var yearRows = state.panel.filter(function (r) { return r.year === state.year && r.gini !== null && r.gini !== undefined; });
    var count = yearRows.length;
    var avg = count ? yearRows.reduce(function (s, r) { return s + r.gini; }, 0) / count : null;

    var byRegion = {};
    yearRows.forEach(function (r) {
      var c = state.countries[r.code];
      if (!c) return;
      if (!byRegion[c.region]) byRegion[c.region] = { sum: 0, count: 0 };
      byRegion[c.region].sum += r.gini;
      byRegion[c.region].count += 1;
    });
    var topRegion = null, topVal = -Infinity;
    Object.keys(byRegion).forEach(function (region) {
      var v = byRegion[region].sum / byRegion[region].count;
      if (v > topVal) { topVal = v; topRegion = region; }
    });

    Viz.skeletonize(els.kpiCount, false);
    Viz.skeletonize(els.kpiAvg, false);
    Viz.skeletonize(els.kpiRegion, false);

    els.kpiCount.textContent = count ? Viz.formatNum(count, 0) : "No data";
    els.kpiAvg.textContent = avg !== null ? avg.toFixed(1) : "—";
    els.kpiRegion.textContent = topRegion || "—";
    els.kpiRegionSub.textContent = topRegion ? "avg. " + topVal.toFixed(1) + " in " + state.year : "by average Gini";
    els.kpiYearLabel1.textContent = "in " + state.year;
    els.kpiYearLabel2.textContent = "in " + state.year;
    els.relYear.textContent = state.year;
  }

  // ---- Trend chart ------------------------------------------------------------
  function renderTrendChart() {
    var years = state.yearsAvg.map(function (d) { return d.year; });
    var values = state.yearsAvg.map(function (d) { return d.avg; });
    var t = Viz.tokens();

    var ctx = els.trendChart.getContext("2d");
    state.trendChart = new Chart(ctx, {
      type: "line",
      data: {
        labels: years,
        datasets: [{
          label: "Average Gini",
          data: values,
          borderColor: t.series[0],
          backgroundColor: Viz.hexToRgba(t.series[0], 0.10),
          fill: true,
          pointRadius: years.map(function (y) { return y === state.year ? 6 : 0; }),
          pointHoverRadius: 6,
          pointBackgroundColor: t.series[0],
          pointBorderColor: t.surface,
          pointBorderWidth: 2
        }]
      },
      options: {
        interaction: { mode: "index", intersect: false },
        plugins: {
          tooltip: {
            callbacks: {
              title: function (items) { return "Year " + items[0].label; },
              label: function (item) { return "Average Gini: " + item.parsed.y.toFixed(1); }
            }
          }
        },
        scales: {
          x: Object.assign({}, Viz.baseGridOptions(), { grid: { display: false }, ticks: { color: t.inkMuted, maxTicksLimit: 10 } }),
          y: Object.assign({}, Viz.baseGridOptions(), { title: { display: true, text: "Gini coefficient", color: t.inkMuted, font: { size: 11 } } })
        }
      },
      plugins: [Viz.crosshairPlugin]
    });
  }

  function updateTrendHighlight() {
    if (!state.trendChart) return;
    var years = state.yearsAvg.map(function (d) { return d.year; });
    state.trendChart.data.datasets[0].pointRadius = years.map(function (y) { return y === state.year ? 6 : 0; });
    state.trendChart.update("none");
  }

  function renderTrendTable() {
    Viz.buildTable(
      els.trendTableWrap,
      "Average Gini coefficient by year",
      ["Year", "Average Gini", "Countries reporting"],
      state.yearsAvg.map(function (d) { return [d.year, d.avg.toFixed(2), d.count]; })
    );
  }

  // ---- Scatter charts -----------------------------------------------------
  function buildScatterData(yearMetricMap, xIsGdp) {
    var points = [];
    var byCode = {};
    state.panel.forEach(function (r) {
      if (r.year !== state.year || r.gini === null || r.gini === undefined) return;
      byCode[r.code] = r;
    });
    Object.keys(byCode).forEach(function (code) {
      var row = byCode[code];
      var c = state.countries[code];
      if (!c) return;
      var xVal, yVal;
      if (xIsGdp) {
        xVal = yearMetricMap[code + "|" + state.year];
        yVal = row.gini;
      } else {
        xVal = row.unemployment;
        yVal = yearMetricMap[code + "|" + state.year];
      }
      if (xVal === null || xVal === undefined || yVal === null || yVal === undefined) return;
      points.push({ x: xVal, y: yVal, name: c.name, region: c.region });
    });
    return points;
  }

  function renderGdpScatter() {
    var points = buildScatterData(state.gdp, true);
    var t = Viz.tokens();

    if (points.length === 0) {
      if (state.gdpChart) { state.gdpChart.destroy(); state.gdpChart = null; }
      els.gdpChart.hidden = true;
      els.gdpEmptyState.hidden = false;
      els.gdpEmptyState.textContent = "No overlapping GDP and Gini data for " + state.year + ".";
      renderScatterTable("gdpTableWrap", "GDP per capita vs. Gini, " + state.year, ["Country", "GDP per capita (US$)", "Gini"], points, function (p) {
        return [p.name, "$" + Viz.formatNum(p.x, 0), p.y.toFixed(1)];
      });
      return;
    }
    els.gdpChart.hidden = false;
    els.gdpEmptyState.hidden = true;

    if (state.gdpChart) state.gdpChart.destroy();
    var ctx = els.gdpChart.getContext("2d");
    state.gdpChart = new Chart(ctx, {
      type: "scatter",
      data: {
        datasets: [{
          label: "Countries",
          data: points,
          backgroundColor: Viz.hexToRgba(t.series[0], 0.65),
          borderColor: t.series[0],
          borderWidth: 1,
          pointRadius: 5,
          pointHoverRadius: 7,
          pointHitRadius: 12
        }]
      },
      options: {
        parsing: false,
        plugins: {
          tooltip: {
            callbacks: {
              title: function (items) { return points[items[0].dataIndex].name; },
              label: function (item) {
                var p = points[item.dataIndex];
                return ["GDP per capita: $" + Viz.formatCompact(p.x), "Gini: " + p.y.toFixed(1)];
              }
            }
          }
        },
        scales: {
          x: Object.assign({}, Viz.baseGridOptions(), {
            type: "logarithmic",
            title: { display: true, text: "GDP per capita (current US$, log scale)", color: t.inkMuted, font: { size: 11 } }
          }),
          y: Object.assign({}, Viz.baseGridOptions(), { title: { display: true, text: "Gini coefficient", color: t.inkMuted, font: { size: 11 } } })
        }
      }
    });
    renderScatterTable("gdpTableWrap", "GDP per capita vs. Gini, " + state.year, ["Country", "GDP per capita (US$)", "Gini"], points, function (p) {
      return [p.name, "$" + Viz.formatNum(p.x, 0), p.y.toFixed(1)];
    });
  }

  function renderEduScatter() {
    var points = buildScatterData(state.edu, false);
    var t = Viz.tokens();

    if (points.length === 0) {
      if (state.eduChart) { state.eduChart.destroy(); state.eduChart = null; }
      els.eduChart.hidden = true;
      els.eduEmptyState.hidden = false;
      els.eduEmptyState.textContent = "No overlapping unemployment and education data for " + state.year + ".";
      renderScatterTable("eduTableWrap", "Unemployment vs. advanced education, " + state.year, ["Country", "Unemployment (%)", "Advanced education (%)"], points, function (p) {
        return [p.name, p.x.toFixed(1), p.y.toFixed(1)];
      });
      return;
    }
    els.eduChart.hidden = false;
    els.eduEmptyState.hidden = true;

    if (state.eduChart) state.eduChart.destroy();
    var ctx = els.eduChart.getContext("2d");
    state.eduChart = new Chart(ctx, {
      type: "scatter",
      data: {
        datasets: [{
          label: "Countries",
          data: points,
          backgroundColor: Viz.hexToRgba(t.series[0], 0.65),
          borderColor: t.series[0],
          borderWidth: 1,
          pointRadius: 5,
          pointHoverRadius: 7,
          pointHitRadius: 12
        }]
      },
      options: {
        parsing: false,
        plugins: {
          tooltip: {
            callbacks: {
              title: function (items) { return points[items[0].dataIndex].name; },
              label: function (item) {
                var p = points[item.dataIndex];
                return ["Unemployment: " + p.x.toFixed(1) + "%", "Advanced education: " + p.y.toFixed(1) + "%"];
              }
            }
          }
        },
        scales: {
          x: Object.assign({}, Viz.baseGridOptions(), { title: { display: true, text: "Unemployment rate (%)", color: t.inkMuted, font: { size: 11 } } }),
          y: Object.assign({}, Viz.baseGridOptions(), { title: { display: true, text: "Advanced education (%)", color: t.inkMuted, font: { size: 11 } } })
        }
      }
    });
    renderScatterTable("eduTableWrap", "Unemployment vs. advanced education, " + state.year, ["Country", "Unemployment (%)", "Advanced education (%)"], points, function (p) {
      return [p.name, p.x.toFixed(1), p.y.toFixed(1)];
    });
  }

  function renderScatterTable(wrapId, caption, columns, points, rowFn) {
    Viz.buildTable(els[wrapId], caption, columns, points.map(rowFn));
  }

  // ---- Region range chart ---------------------------------------------------
  function renderRegionChart() {
    var stats = state.regionStats;
    var domainMin = Math.min.apply(null, stats.map(function (s) { return s.min; }));
    var domainMax = Math.max.apply(null, stats.map(function (s) { return s.max; }));
    var span = domainMax - domainMin;

    els.regionChart.classList.remove("skeleton");
    els.regionChart.innerHTML = "";
    var t = Viz.tokens();

    stats.forEach(function (s) {
      var row = document.createElement("div");
      row.className = "range-row";

      var label = document.createElement("div");
      label.className = "range-row-label";
      label.textContent = s.region;

      var track = document.createElement("div");
      track.className = "range-track";
      var fill = document.createElement("div");
      fill.className = "range-fill";
      var leftPct = ((s.min - domainMin) / span) * 100;
      var widthPct = ((s.max - s.min) / span) * 100;
      fill.style.left = leftPct + "%";
      fill.style.width = widthPct + "%";
      fill.style.background = t.series[0];
      var mid = document.createElement("div");
      mid.className = "range-mid";
      mid.style.left = (((s.avg - domainMin) / span) * 100) + "%";
      track.appendChild(fill);
      track.appendChild(mid);
      track.setAttribute("role", "img");
      track.setAttribute("aria-label", s.region + ": Gini ranges from " + s.min.toFixed(1) + " to " + s.max.toFixed(1) + ", average " + s.avg.toFixed(1));

      var value = document.createElement("div");
      value.className = "range-row-value";
      value.textContent = s.min.toFixed(1) + "–" + s.max.toFixed(1);

      row.appendChild(label);
      row.appendChild(track);
      row.appendChild(value);
      els.regionChart.appendChild(row);
    });
  }

  function renderRegionTable() {
    Viz.buildTable(
      els.regionTableWrap,
      "Gini coefficient range by region, all years",
      ["Region", "Min", "Average", "Max", "Observations"],
      state.regionStats.map(function (s) { return [s.region, s.min.toFixed(1), s.avg.toFixed(1), s.max.toFixed(1), s.count]; })
    );
  }

  // ---- Wiring -----------------------------------------------------------------
  function onYearChange(year) {
    state.year = year;
    els.yearValue.textContent = String(year);
    renderKpis();
    updateTrendHighlight();
    renderTrendTable();
    renderGdpScatter();
    renderEduScatter();
  }

  function wireControls() {
    els.yearSlider.addEventListener("input", function (e) {
      onYearChange(Number(e.target.value));
    });
    els.resetFilters.addEventListener("click", function () {
      els.yearSlider.value = "2008";
      onYearChange(2008);
    });

    Viz.wireTableToggle(els.trendTableToggle, els.trendCanvasWrap, els.trendTableWrap);
    Viz.wireTableToggle(els.gdpTableToggle, els.gdpCanvasWrap, els.gdpTableWrap);
    Viz.wireTableToggle(els.eduTableToggle, els.eduCanvasWrap, els.eduTableWrap);
    Viz.wireTableToggle(els.regionTableToggle, $("regionChartWrap"), els.regionTableWrap);
  }

  function init() {
    cacheEls();
    Viz.applyChartDefaults();
    wireControls();

    loadAll().then(function () {
      state.year = Number(els.yearSlider.value);
      renderKpis();
      renderTrendChart();
      renderTrendTable();
      renderGdpScatter();
      renderEduScatter();
      renderRegionChart();
      renderRegionTable();
    }).catch(function (err) {
      console.error(err);
      document.querySelectorAll(".chart-canvas-wrap, #regionChart").forEach(function (el) {
        el.classList.remove("skeleton");
        el.innerHTML = '<p class="error-state">Could not load dashboard data. Please try reloading the page.</p>';
      });
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
