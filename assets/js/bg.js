// Ambient background field — grid parallax driver.
// Sets one CSS custom property (--bg-ty) that the body::before grid orb reads
// as a translate, so the sphere drifts a touch as you scroll for depth. Only a
// custom property changes, so scrolling re-composites rather than repaints.
// Skipped under prefers-reduced-motion, leaving the grid fully static. (The
// wave drift is a self-contained CSS animation and needs no JS.)
(function () {
  "use strict";

  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return;
  }

  var root = document.documentElement.style;
  var GRID = 52;   // grid cell — parallax wraps here so it stays seamless
  var ticking = false;

  function update() {
    var y = window.pageYOffset || document.documentElement.scrollTop || 0;

    // Subtle parallax only, wrapped to the cell size so it never exposes an
    // untiled edge. No tilt — the grid stays near-static.
    var ty = -((y * 0.04) % GRID);

    root.setProperty("--bg-ty", ty.toFixed(2) + "px");
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
