// The Human Mastery Architecture — "Anima" option
// A glowing particle human figure: bright energy contour, twinkling interior
// field, rising sparks. Pure Canvas, no dependencies. Runs only on the Anima
// theme; respects reduced-motion; pauses off-screen.
(function () {
  "use strict";

  var canvas = document.getElementById("holobody");
  if (!canvas) return;
  var ctx = canvas.getContext("2d");
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  function isAnima() { return document.documentElement.getAttribute("data-theme") === "anima"; }

  /* ---- Body definition (normalised: x≈±0.3, y 0=head top .. 1=feet) ---- */
  // capsules = [x1,y1,x2,y2,radius]; head is a circle.
  var HEAD = [0, 0.065, 0.055];
  var CAPS = [
    [0, 0.12, 0, 0.16, 0.022],            // neck
    [-0.11, 0.175, 0.11, 0.175, 0.03],    // shoulders
    [0, 0.17, 0, 0.30, 0.10],             // upper torso
    [0, 0.30, 0, 0.47, 0.082],            // lower torso / hips
    [-0.10, 0.19, -0.155, 0.33, 0.034],   // L upper arm
    [-0.155, 0.33, -0.185, 0.48, 0.028],  // L forearm
    [0.10, 0.19, 0.155, 0.33, 0.034],     // R upper arm
    [0.155, 0.33, 0.185, 0.48, 0.028],    // R forearm
    [-0.185, 0.48, -0.185, 0.51, 0.026],  // L hand
    [0.185, 0.48, 0.185, 0.51, 0.026],    // R hand
    [-0.055, 0.47, -0.07, 0.72, 0.047],   // L thigh
    [-0.07, 0.72, -0.072, 0.95, 0.036],   // L shin
    [0.055, 0.47, 0.07, 0.72, 0.047],     // R thigh
    [0.07, 0.72, 0.072, 0.95, 0.036],     // R shin
    [-0.072, 0.95, -0.072, 0.985, 0.03],  // L foot
    [0.072, 0.95, 0.072, 0.985, 0.03]     // R foot
  ];

  function d2seg(px, py, x1, y1, x2, y2) {
    var dx = x2 - x1, dy = y2 - y1, l2 = dx * dx + dy * dy;
    var tt = l2 ? ((px - x1) * dx + (py - y1) * dy) / l2 : 0;
    tt = tt < 0 ? 0 : tt > 1 ? 1 : tt;
    var cxx = x1 + tt * dx, cyy = y1 + tt * dy;
    return Math.hypot(px - cxx, py - cyy);
  }
  function inside(x, y) {
    if (Math.hypot(x - HEAD[0], y - HEAD[1]) <= HEAD[2]) return true;
    for (var i = 0; i < CAPS.length; i++) {
      var c = CAPS[i];
      if (d2seg(x, y, c[0], c[1], c[2], c[3]) <= c[4]) return true;
    }
    return false;
  }

  /* ---- Build the point cloud once (edge-weighted) ---- */
  var POINTS = [];        // {x,y,edge,phase,base}
  var seed = 20260108;
  function rnd() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }
  (function build() {
    var target = 1500, tries = 0;
    while (POINTS.length < target && tries < target * 40) {
      tries++;
      var x = (rnd() - 0.5) * 0.7;
      var y = rnd() * 1.0;
      if (!inside(x, y)) continue;
      // edgeness: how many near-neighbours fall OUTSIDE the body (outer contour → bright)
      var out = 0, r = 0.013;
      for (var a = 0; a < 8; a++) {
        var ang = a / 8 * Math.PI * 2;
        if (!inside(x + Math.cos(ang) * r, y + Math.sin(ang) * r)) out++;
      }
      var edge = out / 8;
      POINTS.push({ x: x, y: y, edge: edge, phase: rnd() * Math.PI * 2, base: 0.22 + 0.78 * edge });
    }
  })();

  /* ---- Rising sparks ---- */
  var SPARKS = [];
  for (var s = 0; s < 70; s++) SPARKS.push(spark(true));
  function spark(initial) {
    return {
      x: (rnd() - 0.5) * 0.36,
      y: initial ? rnd() : 0.6 + rnd() * 0.45,
      vy: 0.0012 + rnd() * 0.0028,
      life: rnd(), size: 0.5 + rnd() * 1.4
    };
  }

  /* ---- Glow sprite (pre-rendered once; cheap drawImage per particle) ---- */
  var sprite = document.createElement("canvas");
  sprite.width = sprite.height = 32;
  (function () {
    var g = sprite.getContext("2d");
    var rg = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    rg.addColorStop(0, "rgba(220,240,255,1)");
    rg.addColorStop(0.25, "rgba(130,195,255,0.9)");
    rg.addColorStop(0.6, "rgba(60,140,255,0.35)");
    rg.addColorStop(1, "rgba(40,110,255,0)");
    g.fillStyle = rg;
    g.fillRect(0, 0, 32, 32);
  })();

  /* ---- Sizing ---- */
  var W = 0, H = 0, dpr = 1, cx = 0, fh = 0, top = 0, unit = 0;
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    var rect = canvas.getBoundingClientRect();
    W = rect.width; H = rect.height;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    fh = H * 0.92; top = H * 0.04; cx = W / 2;
    unit = fh * 0.012;              // base particle size
  }

  /* ---- Render ---- */
  var t = 0;
  function frame() {
    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = "lighter";

    var breathe = 1 + Math.sin(t * 1.1) * 0.012;
    var floatY = Math.sin(t * 0.7) * fh * 0.006;
    var fhB = fh * breathe;

    // body field
    for (var i = 0; i < POINTS.length; i++) {
      var p = POINTS[i];
      var tw = 0.45 + 0.55 * Math.sin(t * 2.2 + p.phase);
      var alpha = p.base * (reduce ? 0.8 : tw);
      if (alpha <= 0.02) continue;
      var px = cx + p.x * fhB;
      var py = top + p.y * fhB + floatY;
      var sz = unit * (0.7 + 1.8 * p.edge) * (0.85 + 0.3 * (reduce ? 1 : tw));
      ctx.globalAlpha = alpha;
      ctx.drawImage(sprite, px - sz, py - sz, sz * 2, sz * 2);
    }

    // rising sparks
    for (var k = 0; k < SPARKS.length; k++) {
      var q = SPARKS[k];
      if (!reduce) { q.y -= q.vy; q.life -= 0.004; }
      if (q.y < -0.02 || q.life <= 0) { SPARKS[k] = spark(false); q = SPARKS[k]; }
      var fade = Math.max(0, Math.min(1, q.life)) * 0.9;
      var qx = cx + q.x * fhB;
      var qy = top + q.y * fhB + floatY;
      var qs = unit * q.size;
      ctx.globalAlpha = fade;
      ctx.drawImage(sprite, qx - qs, qy - qs, qs * 2, qs * 2);
    }

    // ground glow
    ctx.globalAlpha = 0.5 + (reduce ? 0 : Math.sin(t * 1.6) * 0.12);
    var gy = top + 0.985 * fhB + floatY;
    var gs = fhB * 0.14;
    ctx.drawImage(sprite, cx - gs, gy - gs * 0.4, gs * 2, gs * 0.8);

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }

  /* ---- Loop control ---- */
  var running = false, raf = 0, inView = true;
  function tick() {
    if (!reduce) t += 0.016;
    frame();
    if (!reduce && running && inView && !document.hidden && isAnima()) raf = requestAnimationFrame(tick);
    else running = false;
  }
  function start() {
    if (running || !isAnima()) return;
    if (reduce) { resize(); frame(); return; }
    running = true; raf = requestAnimationFrame(tick);
  }
  function stop() { running = false; if (raf) cancelAnimationFrame(raf); ctx.clearRect(0, 0, W, H); }

  resize();
  canvas.classList.add("is-ready");
  if (isAnima()) { frame(); start(); }

  window.addEventListener("resize", function () { resize(); if (isAnima()) frame(); });
  document.addEventListener("visibilitychange", function () { if (!document.hidden) start(); });
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (es) { inView = es[0].isIntersecting; if (inView) start(); },
      { threshold: 0.01 }).observe(canvas);
  }
  new MutationObserver(function () {
    if (isAnima()) { resize(); frame(); start(); } else { stop(); }
  }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
})();
