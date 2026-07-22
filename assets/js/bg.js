// Ambient background field — scroll "warp" driver.
// Sets three CSS custom properties on :root that the body::before / body::after
// layers (see styles.css) read as transforms. Only custom properties change, so
// scrolling re-composites rather than repaints. Fully skipped when the user
// prefers reduced motion, leaving a static grid.
(function () {
  "use strict";

  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return;
  }

  var root = document.documentElement.style;
  var GRID = 52;   // grid cell — parallax wraps here so it stays seamless
  var WAVE = 60;   // wave tile height — drift wraps here
  var ticking = false;

  function update() {
    var y = window.pageYOffset || document.documentElement.scrollTop || 0;

    // Position-based warp: a long-wavelength sine so the grid tilts one way
    // scrolling down and eases back scrolling up (max ~6deg).
    var tilt = Math.sin(y / 640) * 6;

    // Parallax + wave drift, each wrapped to its tile so it never exposes an
    // untiled edge.
    var ty = -((y * 0.08) % GRID);
    var wy = (y * 0.12) % WAVE;

    root.setProperty("--bg-rx", tilt.toFixed(2) + "deg");
    root.setProperty("--bg-ty", ty.toFixed(2) + "px");
    root.setProperty("--bg-wy", wy.toFixed(2) + "px");
    ticking = false;
  }

  function onScroll() {
    if (!ticking) {
      ticking = true;
      window.requestAnimationFrame(update);
    }
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  update();
})();
