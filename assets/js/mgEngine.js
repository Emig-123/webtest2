// Pure calculation engine for the Metallgesellschaft stack-and-roll hedging case study.
// No randomness lives here — every function is a deterministic (path, constants, inputs) -> output
// transform, replicating the source workbook's formulas exactly (StacknRoll Strategy Analysis,
// Hedge Ratio Analysis, Sensitivity Table sheets). Market-path randomness is generated separately
// (see generateMarketPath below) and always passed in as frozen data.
(function (global) {
  "use strict";

  // ---- Seedable PRNG + normal variate (for future "generate new path" work; unused by the
  // frozen baseline scenario shipped today) -----------------------------------------------------
  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Box-Muller transform: standard normal from two uniforms, scaled to (mean, stdev).
  // Not a bit-for-bit match for Excel's NORM.INV(RAND()) — only same-seed-same-path determinism
  // within this site is required, since no path-generation UI ships yet.
  function normalVariate(rng, mean, stdev) {
    var u1 = Math.max(rng(), 1e-12); // avoid log(0)
    var u2 = rng();
    var z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return mean + z * stdev;
  }

  // Extension point for a future "Generate New Market Path" control. Not wired to any UI today.
  function generateMarketPath(seed, months, mean, stdev) {
    var rng = mulberry32(seed);
    var prices = [];
    for (var i = 0; i < months; i++) prices.push(normalVariate(rng, mean, stdev));
    return prices;
  }

  // ---- StacknRoll Strategy Analysis: monthly roll/delivery P&L table ---------------------------
  // C: nextMonth = frontPrice * (1 + monthlyReturn)      [Backwardation input is NOT consumed here —
  //                                                        matches the source workbook exactly]
  // D: rollPnL = frontPrice - nextMonth
  // E: totalRollPnL = rollPnL * monthlyVolume
  // F: deliveryPnL = nextMonth - fixedPrice
  // G: totalDeliveryPnL = deliveryPnL * monthlyVolume
  function computeMonthlyTable(frontPrices, c) {
    var months = frontPrices.map(function (frontPrice, i) {
      var nextMonth = frontPrice * (1 + c.monthlyReturn);
      var rollPnL = frontPrice - nextMonth;
      var totalRollPnL = rollPnL * c.monthlyVolume;
      var deliveryPnL = nextMonth - c.fixedPrice;
      var totalDeliveryPnL = deliveryPnL * c.monthlyVolume;
      return {
        month: i + 1,
        frontPrice: frontPrice,
        nextMonth: nextMonth,
        rollPnL: rollPnL,
        totalRollPnL: totalRollPnL,
        deliveryPnL: deliveryPnL,
        totalDeliveryPnL: totalDeliveryPnL
      };
    });

    var totalRollPnL = months.reduce(function (s, m) { return s + m.totalRollPnL; }, 0);
    var totalDeliveryPnL = months.reduce(function (s, m) { return s + m.totalDeliveryPnL; }, 0);
    var backwardationSpread = months.reduce(function (s, m) { return s + m.rollPnL; }, 0) / months.length;

    return {
      months: months,
      totalRollPnL: totalRollPnL,
      totalDeliveryPnL: totalDeliveryPnL,
      netTotalPnL: totalRollPnL + totalDeliveryPnL,
      backwardationSpread: backwardationSpread
    };
  }

  // ---- Hedge Ratio Analysis: one row per hedge ratio H --------------------------------------
  // RollProfit  = H * backwardationSpread * monthlyVolumeGrid
  // LaR_h       = H * lar
  // Delivery    = d3Delivery * monthlyVolumeGrid * H   [d3Delivery is 0 in the source workbook —
  //                                                      the referenced cell is blank; kept in the
  //                                                      formula for fidelity rather than dropped]
  // ShortFall   = max(0, (-LaR_h - RollProfit) - availableLiquidity)
  // FundingCost = ShortFall * monthlyFundingRate * horizonMonths
  // NetProfit   = RollProfit - FundingCost + LaR_h + Delivery
  function computeHedgeRatioGrid(backwardationSpread, c) {
    var rows = [];
    var steps = Math.round((c.hrMax - c.hrMin) / c.hrStep) + 1;
    for (var i = 0; i < steps; i++) {
      var h = Math.round((c.hrMin + i * c.hrStep) * 1e8) / 1e8; // guard float drift
      var rollProfit = h * backwardationSpread * c.monthlyVolumeGrid;
      var larH = h * c.lar;
      var delivery = c.d3Delivery * c.monthlyVolumeGrid * h;
      var shortfall = Math.max(0, (-larH - rollProfit) - c.availableLiquidity);
      var fundingCost = shortfall * c.monthlyFundingRate * c.horizonMonths;
      var netProfit = rollProfit - fundingCost + larH + delivery;
      rows.push({ h: h, rollProfit: rollProfit, larH: larH, delivery: delivery, shortfall: shortfall, fundingCost: fundingCost, netProfit: netProfit });
    }
    return rows;
  }

  // ---- Sensitivity Table: 21 price columns x 20 hedge-ratio rows = 420 cells -----------------
  // value = (spot - price) * sensitivityVolumeFactor + (netProfit(H) - shortfall(H))
  function computeSensitivityGrid(hedgeGrid, c) {
    var prices = [];
    var steps = Math.round((c.priceMax - c.priceMin) / c.priceStep) + 1;
    for (var i = 0; i < steps; i++) prices.push(Math.round((c.priceMin + i * c.priceStep) * 1e8) / 1e8);

    var rows = hedgeGrid.map(function (hr) {
      var cells = prices.map(function (price) {
        var value = (c.spot - price) * c.sensitivityVolumeFactor + (hr.netProfit - hr.shortfall);
        return { price: price, h: hr.h, value: value };
      });
      return { h: hr.h, cells: cells };
    });

    return { prices: prices, rows: rows };
  }

  // ---- Top-level: build the full derived scenario from frozen baseline data -----------------
  function buildScenario(data) {
    var c = data.constants;
    var monthly = computeMonthlyTable(data.path.frontPrices, c);
    var hedgeGrid = computeHedgeRatioGrid(monthly.backwardationSpread, c);
    var sensitivity = computeSensitivityGrid(hedgeGrid, c);

    var flatValues = sensitivity.rows.reduce(function (acc, row) {
      return acc.concat(row.cells.map(function (cell) { return cell.value; }));
    }, []);

    return {
      meta: data.meta,
      constants: c,
      monthly: monthly,
      hedgeGrid: hedgeGrid,
      sensitivity: sensitivity,
      summary: {
        min: Math.min.apply(null, flatValues),
        max: Math.max.apply(null, flatValues),
        profitableShare: flatValues.filter(function (v) { return v > 0; }).length / flatValues.length
      }
    };
  }

  global.MGEngine = {
    mulberry32: mulberry32,
    normalVariate: normalVariate,
    generateMarketPath: generateMarketPath,
    computeMonthlyTable: computeMonthlyTable,
    computeHedgeRatioGrid: computeHedgeRatioGrid,
    computeSensitivityGrid: computeSensitivityGrid,
    buildScenario: buildScenario
  };
})(window);
