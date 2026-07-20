(function () {
  "use strict";

  var DATA_BASE = "../assets/data/";
  var MIN_N = 5; // below this sample size, a slice is "insufficient data"
  var YEARS = [2009, 2012, 2015, 2018, 2021];
  var DEFAULT_YEAR = 2021;
  var DEFAULT_INCOME = 5;    // $50k-$74,999
  var DEFAULT_EMPLOYMENT = 3; // Work Part-Time (matches the original workbook's default slicer selection)

  var els = {};
  var state = {
    rows: [],
    incomeDim: [], educationDim: [], stateDim: [], employmentDim: [],
    incomeLabel: {}, educationLabel: {}, stateLabel: {}, employmentLabel: {},
    filters: { year: DEFAULT_YEAR, income: DEFAULT_INCOME, employment: DEFAULT_EMPLOYMENT },
    stateSortByValue: false,
    charts: {}
  };

  function $(id) { return document.getElementById(id); }

  function cacheEls() {
    ["yearSelect", "incomeSelect", "employmentSelect", "resetFilters",
     "kpiEf", "kpiEfMeter", "kpiEfSub", "kpiIncomeGap", "kpiEduGap",
     "incomeChart", "incomeCanvasWrap", "incomeTableWrap", "incomeTableToggle", "incomeChartCaption",
     "debtChart", "debtCanvasWrap", "debtTableWrap", "debtTableToggle", "debtChartCaption", "debtLegend",
     "stateHeatmap", "stateHeatmapWrap", "stateTableWrap", "stateTableToggle", "stateSortToggle", "stateChartCaption",
     "corrChart", "corrCanvasWrap", "corrTableWrap", "corrTableToggle", "corrStatBox"
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
      fetchJson(DATA_BASE + "finra_respondents.json"),
      fetchJson(DATA_BASE + "finra_dim_income.json"),
      fetchJson(DATA_BASE + "finra_dim_education.json"),
      fetchJson(DATA_BASE + "finra_dim_state.json"),
      fetchJson(DATA_BASE + "finra_dim_employment.json")
    ]).then(function (results) {
      var rowsRaw = results[0];
      state.incomeDim = results[1];
      state.educationDim = results[2];
      state.stateDim = results[3];
      state.employmentDim = results[4];

      state.rows = rowsRaw.map(function (r) {
        return { year: r[0], state: r[1], income: r[2], education: r[3], employment: r[4], ef: r[5], debt: r[6], finsat: r[7] };
      });

      state.incomeDim.forEach(function (r) { state.incomeLabel[r[0]] = r[1]; });
      state.educationDim.forEach(function (r) { state.educationLabel[r[0]] = r[1]; });
      state.stateDim.forEach(function (r) { state.stateLabel[r[0]] = r[1]; });
      state.employmentDim.forEach(function (r) { state.employmentLabel[r[0]] = r[1]; });
    });
  }

  // ---- Statistics -------------------------------------------------------------
  function mean(arr) { return arr.reduce(function (s, v) { return s + v; }, 0) / arr.length; }

  function pearson(xs, ys) {
    var n = xs.length;
    var mx = mean(xs), my = mean(ys);
    var num = 0, dx2 = 0, dy2 = 0;
    for (var i = 0; i < n; i++) {
      var dx = xs[i] - mx, dy = ys[i] - my;
      num += dx * dy; dx2 += dx * dx; dy2 += dy * dy;
    }
    var denom = Math.sqrt(dx2 * dy2);
    return denom === 0 ? 0 : num / denom;
  }

  // Lanczos approximation for ln(Gamma(x))
  function logGamma(x) {
    var g = 7;
    var c = [
      0.99999999999980993, 676.5203681218851, -1259.1392167224028,
      771.32342877765313, -176.61502916214059, 12.507343278686905,
      -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7
    ];
    if (x < 0.5) {
      return Math.log(Math.PI / Math.sin(Math.PI * x)) - logGamma(1 - x);
    }
    x -= 1;
    var a = c[0];
    var t = x + g + 0.5;
    for (var i = 1; i < g + 2; i++) a += c[i] / (x + i);
    return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
  }

  function betacf(x, a, b) {
    var MAXIT = 200, EPS = 3e-9, FPMIN = 1e-30;
    var qab = a + b, qap = a + 1, qam = a - 1;
    var c = 1, d = 1 - qab * x / qap;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    d = 1 / d;
    var h = d;
    for (var m = 1; m <= MAXIT; m++) {
      var m2 = 2 * m;
      var aa = m * (b - m) * x / ((qam + m2) * (a + m2));
      d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
      c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
      d = 1 / d;
      h *= d * c;
      aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
      d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
      c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
      d = 1 / d;
      var del = d * c;
      h *= del;
      if (Math.abs(del - 1) < EPS) break;
    }
    return h;
  }

  function betai(x, a, b) {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    var bt = Math.exp(logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x));
    if (x < (a + 1) / (a + b + 2)) {
      return bt * betacf(x, a, b) / a;
    }
    return 1 - bt * betacf(1 - x, b, a) / b;
  }

  // Two-tailed p-value for Student's t with df degrees of freedom.
  function tTestTwoTailP(t, df) {
    if (df <= 0) return null;
    var x = df / (df + t * t);
    return betai(x, df / 2, 0.5);
  }

  function correlationStats(xs, ys) {
    var n = xs.length;
    if (n < 3) return null;
    var r = pearson(xs, ys);
    var df = n - 2;
    if (Math.abs(r) >= 1) return { n: n, r: r, t: Infinity, p: 0, df: df };
    var t = r * Math.sqrt(df / (1 - r * r));
    var p = tTestTwoTailP(Math.abs(t), df);
    return { n: n, r: r, t: t, p: p, df: df };
  }

  // ---- Filtering & measures ---------------------------------------------------
  function filterRows(criteria) {
    return state.rows.filter(function (r) {
      if (criteria.year !== undefined && criteria.year !== null && r.year !== criteria.year) return false;
      if (criteria.income !== undefined && criteria.income !== null && r.income !== criteria.income) return false;
      if (criteria.employment !== undefined && criteria.employment !== null && r.employment !== criteria.employment) return false;
      if (criteria.education !== undefined && criteria.education !== null && r.education !== criteria.education) return false;
      if (criteria.state !== undefined && criteria.state !== null && r.state !== criteria.state) return false;
      return true;
    });
  }

  function pctEmergencyFund(rows) {
    var yes = 0, denom = 0;
    rows.forEach(function (r) {
      if (r.ef === 1) { yes++; denom++; } else if (r.ef === 2) { denom++; }
    });
    return { value: denom >= MIN_N ? yes / denom : null, n: denom };
  }

  function pctTooMuchDebt(rows) {
    var yes = 0;
    rows.forEach(function (r) { if (r.debt === 1) yes++; });
    return { value: rows.length >= MIN_N ? yes / rows.length : null, n: rows.length };
  }

  function avgFinSat(rows) {
    var vals = rows.filter(function (r) { return r.finsat !== null && r.finsat !== undefined; }).map(function (r) { return r.finsat; });
    return { value: vals.length >= MIN_N ? mean(vals) : null, n: vals.length };
  }

  // ---- Filter dropdowns ---------------------------------------------------
  function populateFilters() {
    YEARS.forEach(function (y) {
      var opt = document.createElement("option");
      opt.value = String(y);
      opt.textContent = String(y);
      if (y === DEFAULT_YEAR) opt.selected = true;
      els.yearSelect.appendChild(opt);
    });

    var allIncome = document.createElement("option");
    allIncome.value = ""; allIncome.textContent = "All income brackets";
    els.incomeSelect.appendChild(allIncome);
    state.incomeDim.forEach(function (r) {
      var opt = document.createElement("option");
      opt.value = String(r[0]); opt.textContent = r[1];
      if (r[0] === DEFAULT_INCOME) opt.selected = true;
      els.incomeSelect.appendChild(opt);
    });

    var allEmp = document.createElement("option");
    allEmp.value = ""; allEmp.textContent = "All employment statuses";
    els.employmentSelect.appendChild(allEmp);
    state.employmentDim.forEach(function (r) {
      var opt = document.createElement("option");
      opt.value = String(r[0]); opt.textContent = r[1];
      if (r[0] === DEFAULT_EMPLOYMENT) opt.selected = true;
      els.employmentSelect.appendChild(opt);
    });
  }

  function filterSummaryLabel(includeIncome, includeYear, includeEmployment) {
    var parts = [];
    if (includeYear) parts.push(String(state.filters.year));
    if (includeIncome) parts.push(state.filters.income ? state.incomeLabel[state.filters.income] : "All incomes");
    if (includeEmployment) parts.push(state.filters.employment ? state.employmentLabel[state.filters.employment] : "All employment");
    return parts.join(" · ");
  }

  // ---- KPIs -----------------------------------------------------------------
  function renderKpis() {
    var baseRows = filterRows(state.filters);
    var ef = pctEmergencyFund(baseRows);

    Viz.skeletonize(els.kpiEf, false);
    Viz.skeletonize(els.kpiIncomeGap, false);
    Viz.skeletonize(els.kpiEduGap, false);

    els.kpiEf.textContent = ef.value !== null ? Viz.formatPct(ef.value) : "Insufficient data";
    els.kpiEfMeter.style.width = ef.value !== null ? (ef.value * 100) + "%" : "0%";
    els.kpiEfSub.textContent = "of " + Viz.formatNum(ef.n, 0) + " respondents in this slice";

    var gapRows = filterRows({ year: state.filters.year, employment: state.filters.employment });
    var high = pctEmergencyFund(gapRows.filter(function (r) { return r.income === 8; }));
    var low = pctEmergencyFund(gapRows.filter(function (r) { return r.income === 1; }));
    els.kpiIncomeGap.textContent = (high.value !== null && low.value !== null)
      ? Viz.formatPct(high.value - low.value, 0) : "Insufficient data";

    var eduRows = baseRows;
    var eduHigh = pctEmergencyFund(eduRows.filter(function (r) { return r.education === 5; }));
    var eduLow = pctEmergencyFund(eduRows.filter(function (r) { return r.education === 1; }));
    els.kpiEduGap.textContent = (eduHigh.value !== null && eduLow.value !== null)
      ? Viz.formatPct(eduHigh.value - eduLow.value, 0) : "Insufficient data";
  }

  // ---- Income bar chart -----------------------------------------------------
  function renderIncomeChart() {
    var rows = filterRows({ year: state.filters.year, employment: state.filters.employment });
    els.incomeChartCaption.textContent = filterSummaryLabel(false, true, true);

    var labels = state.incomeDim.map(function (r) { return r[1]; });
    var results = state.incomeDim.map(function (r) { return pctEmergencyFund(rows.filter(function (row) { return row.income === r[0]; })); });
    var colors = Viz.ordinalRamp(state.incomeDim.length);

    if (state.charts.income) state.charts.income.destroy();
    var ctx = els.incomeChart.getContext("2d");
    state.charts.income = new Chart(ctx, {
      type: "bar",
      data: {
        labels: labels,
        datasets: [{
          data: results.map(function (r) { return r.value === null ? 0 : r.value * 100; }),
          backgroundColor: colors,
          maxBarThickness: 44
        }]
      },
      options: {
        plugins: {
          tooltip: {
            callbacks: {
              title: function (items) { return labels[items[0].dataIndex]; },
              label: function (item) {
                var r = results[item.dataIndex];
                return r.value === null
                  ? "Insufficient data (n=" + r.n + ")"
                  : "Has emergency fund: " + (r.value * 100).toFixed(0) + "% (n=" + r.n + ")";
              }
            }
          }
        },
        scales: {
          x: Object.assign({}, Viz.baseGridOptions(), { grid: { display: false }, ticks: { color: Viz.tokens().inkMuted, autoSkip: false, maxRotation: 40, minRotation: 0 } }),
          y: Object.assign({}, Viz.baseGridOptions(), { beginAtZero: true, max: 100, title: { display: true, text: "% with emergency fund", color: Viz.tokens().inkMuted, font: { size: 11 } } })
        }
      }
    });

    Viz.buildTable(els.incomeTableWrap, "Emergency fund % by income bracket, " + filterSummaryLabel(false, true, true),
      ["Income bracket", "% with emergency fund", "Respondents"],
      state.incomeDim.map(function (r, i) {
        var res = results[i];
        return [r[1], res.value === null ? "Insufficient data" : Viz.formatPct(res.value), res.n];
      }));
  }

  // ---- Debt-by-education line chart -----------------------------------------
  function renderDebtChart() {
    var rows = filterRows({ income: state.filters.income, employment: state.filters.employment });
    els.debtChartCaption.textContent = filterSummaryLabel(true, false, true);

    var colors = Viz.ordinalRamp(state.educationDim.length);
    var datasets = state.educationDim.map(function (edu, i) {
      var data = YEARS.map(function (y) {
        var subset = rows.filter(function (r) { return r.year === y && r.education === edu[0]; });
        var res = pctTooMuchDebt(subset);
        return res.value === null ? null : res.value * 100;
      });
      return {
        label: edu[1],
        data: data,
        borderColor: colors[i],
        backgroundColor: colors[i],
        pointRadius: 4,
        pointHoverRadius: 6,
        pointBackgroundColor: colors[i],
        pointBorderColor: Viz.tokens().surface,
        pointBorderWidth: 1.5,
        spanGaps: true
      };
    });

    if (state.charts.debt) state.charts.debt.destroy();
    var ctx = els.debtChart.getContext("2d");
    state.charts.debt = new Chart(ctx, {
      type: "line",
      data: { labels: YEARS.map(String), datasets: datasets },
      options: {
        interaction: { mode: "index", intersect: false },
        plugins: {
          tooltip: {
            callbacks: {
              title: function (items) { return "Year " + items[0].label; },
              label: function (item) {
                return item.dataset.label + ": " + (item.parsed.y === null || item.parsed.y === undefined ? "insufficient data" : item.parsed.y.toFixed(0) + "%");
              }
            }
          }
        },
        scales: {
          x: Object.assign({}, Viz.baseGridOptions(), { grid: { display: false } }),
          y: Object.assign({}, Viz.baseGridOptions(), { beginAtZero: true, title: { display: true, text: "% reporting too much debt", color: Viz.tokens().inkMuted, font: { size: 11 } } })
        }
      },
      plugins: [Viz.crosshairPlugin]
    });

    Viz.buildLegend(els.debtLegend, state.educationDim.map(function (edu, i) { return { color: colors[i], label: edu[1] }; }));

    var tableRows = [];
    state.educationDim.forEach(function (edu) {
      YEARS.forEach(function (y) {
        var subset = rows.filter(function (r) { return r.year === y && r.education === edu[0]; });
        var res = pctTooMuchDebt(subset);
        tableRows.push([edu[1], y, res.value === null ? "Insufficient data" : Viz.formatPct(res.value), res.n]);
      });
    });
    Viz.buildTable(els.debtTableWrap, "Too much debt % by education level and year, " + filterSummaryLabel(true, false, true),
      ["Education level", "Year", "% too much debt", "Respondents"], tableRows);
  }

  // ---- State heatmap ----------------------------------------------------------
  function computeStateStats() {
    var rows = filterRows(state.filters);
    return state.stateDim.map(function (s) {
      var subset = rows.filter(function (r) { return r.state === s[0]; });
      var fs = avgFinSat(subset);
      var debt = pctTooMuchDebt(subset);
      return { code: s[0], name: s[1], finsat: fs.value, finsatN: fs.n, debt: debt.value, n: subset.length };
    });
  }

  function renderStateHeatmap() {
    els.stateChartCaption.textContent = filterSummaryLabel(true, true, true);
    var stats = computeStateStats();
    var display = stats.slice();
    if (state.stateSortByValue) {
      display.sort(function (a, b) {
        if (a.finsat === null) return 1;
        if (b.finsat === null) return -1;
        return b.finsat - a.finsat;
      });
    } else {
      display.sort(function (a, b) { return a.name.localeCompare(b.name); });
    }

    var valid = stats.filter(function (s) { return s.finsat !== null; });
    var domainMin = valid.length ? Math.min.apply(null, valid.map(function (s) { return s.finsat; })) : 0;
    var domainMax = valid.length ? Math.max.apply(null, valid.map(function (s) { return s.finsat; })) : 10;
    var span = domainMax - domainMin || 1;

    els.stateHeatmap.classList.remove("skeleton");
    els.stateHeatmap.innerHTML = "";

    if (valid.length === 0) {
      els.stateHeatmap.innerHTML = '<p class="empty-state">No states have at least ' + MIN_N + ' respondents in this filter combination. Try a broader filter.</p>';
    }

    display.forEach(function (s) {
      var tile = document.createElement("div");
      tile.className = "heat-tile";
      if (s.finsat === null) {
        tile.style.background = "transparent";
        tile.style.color = "var(--ink-muted)";
        tile.style.borderStyle = "dashed";
      } else {
        var t = (s.finsat - domainMin) / span;
        var color = Viz.sequentialColor(t);
        tile.style.background = color;
        tile.style.color = Viz.textOnFill(color);
        tile.style.borderColor = "transparent";
      }
      var label = document.createElement("span");
      label.className = "heat-label";
      label.textContent = s.name;
      var value = document.createElement("span");
      value.className = "heat-value";
      value.textContent = s.finsat === null ? "n/a" : s.finsat.toFixed(1);
      tile.appendChild(label);
      tile.appendChild(value);
      tile.tabIndex = 0;
      tile.setAttribute("role", "img");
      tile.setAttribute("aria-label", s.name + ": " + (s.finsat === null ? "insufficient data" : "average financial satisfaction " + s.finsat.toFixed(1) + " out of 10, n=" + s.finsatN));
      els.stateHeatmap.appendChild(tile);
    });

    Viz.buildTable(els.stateTableWrap, "Average financial satisfaction by state, " + filterSummaryLabel(true, true, true),
      ["State", "Avg. financial satisfaction (1-10)", "Respondents"],
      stats.slice().sort(function (a, b) { return a.name.localeCompare(b.name); }).map(function (s) {
        return [s.name, s.finsat === null ? "Insufficient data" : s.finsat.toFixed(2), s.finsatN];
      }));
  }

  // ---- Correlation scatter ----------------------------------------------------
  function renderCorrChart() {
    var stats = computeStateStats().filter(function (s) { return s.finsat !== null && s.debt !== null; });
    var points = stats.map(function (s) { return { x: s.debt * 100, y: s.finsat, name: s.name, n: s.n }; });
    var t = Viz.tokens();

    if (state.charts.corr) state.charts.corr.destroy();
    var ctx = els.corrChart.getContext("2d");
    state.charts.corr = new Chart(ctx, {
      type: "scatter",
      data: {
        datasets: [{
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
                return ["Too much debt: " + p.x.toFixed(0) + "%", "Financial satisfaction: " + p.y.toFixed(1), "n=" + p.n];
              }
            }
          }
        },
        scales: {
          x: Object.assign({}, Viz.baseGridOptions(), { title: { display: true, text: "% reporting too much debt", color: t.inkMuted, font: { size: 11 } } }),
          y: Object.assign({}, Viz.baseGridOptions(), { title: { display: true, text: "Avg. financial satisfaction (1-10)", color: t.inkMuted, font: { size: 11 } } })
        }
      }
    });

    Viz.buildTable(els.corrTableWrap, "Debt burden vs. financial satisfaction by state, " + filterSummaryLabel(true, true, true),
      ["State", "% too much debt", "Avg. financial satisfaction", "Respondents"],
      points.map(function (p) { return [p.name, p.x.toFixed(0) + "%", p.y.toFixed(1), p.n]; }));

    renderCorrStats(points);
  }

  function renderCorrStats(points) {
    els.corrStatBox.innerHTML = "";
    if (points.length < 3) {
      els.corrStatBox.innerHTML = '<p class="stat-box-note">Fewer than 3 states have sufficient data in this filter combination — correlation not computed.</p>';
      return;
    }
    var xs = points.map(function (p) { return p.x; });
    var ys = points.map(function (p) { return p.y; });
    var stats = correlationStats(xs, ys);
    var sig = stats.p !== null && stats.p < 0.05;

    var items = [
      ["States (N)", String(stats.n)],
      ["Correlation (r)", stats.r.toFixed(3)],
      ["T-statistic", isFinite(stats.t) ? stats.t.toFixed(3) : "—"],
      ["P-value", stats.p === null ? "—" : stats.p.toFixed(3)]
    ];
    items.forEach(function (pair) {
      var d = document.createElement("div");
      d.className = "stat-box-item";
      var k = document.createElement("span"); k.className = "k"; k.textContent = pair[0];
      var v = document.createElement("span"); v.className = "v"; v.textContent = pair[1];
      d.appendChild(k); d.appendChild(v);
      els.corrStatBox.appendChild(d);
    });
    var note = document.createElement("p");
    note.className = "stat-box-note";
    note.textContent = stats.p === null
      ? "P-value not available."
      : (sig ? "Statistically significant at the 5% level." : "Not statistically significant at the 5% level (p ≥ 0.05).");
    els.corrStatBox.appendChild(note);
  }

  // ---- Wiring -----------------------------------------------------------------
  function renderAll() {
    renderKpis();
    renderIncomeChart();
    renderDebtChart();
    renderStateHeatmap();
    renderCorrChart();
  }

  function wireControls() {
    els.yearSelect.addEventListener("change", function () {
      state.filters.year = Number(els.yearSelect.value);
      renderAll();
    });
    els.incomeSelect.addEventListener("change", function () {
      state.filters.income = els.incomeSelect.value ? Number(els.incomeSelect.value) : null;
      renderAll();
    });
    els.employmentSelect.addEventListener("change", function () {
      state.filters.employment = els.employmentSelect.value ? Number(els.employmentSelect.value) : null;
      renderAll();
    });
    els.resetFilters.addEventListener("click", function () {
      state.filters = { year: DEFAULT_YEAR, income: DEFAULT_INCOME, employment: DEFAULT_EMPLOYMENT };
      els.yearSelect.value = String(DEFAULT_YEAR);
      els.incomeSelect.value = String(DEFAULT_INCOME);
      els.employmentSelect.value = String(DEFAULT_EMPLOYMENT);
      renderAll();
    });

    els.stateSortToggle.addEventListener("click", function () {
      state.stateSortByValue = !state.stateSortByValue;
      els.stateSortToggle.setAttribute("aria-pressed", String(state.stateSortByValue));
      els.stateSortToggle.textContent = state.stateSortByValue ? "Sort alphabetically" : "Sort by value";
      renderStateHeatmap();
    });

    Viz.wireTableToggle(els.incomeTableToggle, els.incomeCanvasWrap, els.incomeTableWrap);
    Viz.wireTableToggle(els.debtTableToggle, els.debtCanvasWrap, els.debtTableWrap);
    Viz.wireTableToggle(els.stateTableToggle, els.stateHeatmapWrap, els.stateTableWrap);
    Viz.wireTableToggle(els.corrTableToggle, els.corrCanvasWrap, els.corrTableWrap);
  }

  function init() {
    cacheEls();
    Viz.applyChartDefaults();

    loadAll().then(function () {
      populateFilters();
      wireControls();
      renderAll();
    }).catch(function (err) {
      console.error(err);
      document.querySelectorAll(".chart-canvas-wrap, #stateHeatmap").forEach(function (el) {
        el.classList.remove("skeleton");
        el.innerHTML = '<p class="error-state">Could not load dashboard data. Please try reloading the page.</p>';
      });
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
