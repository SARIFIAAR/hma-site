// The Human Mastery Architecture — holographic wireframe (no dependencies)
// A slowly rotating icosahedron lattice. Theme-aware: glowing champagne on
// Nocturne, etched gold on Atelier. Respects reduced-motion; pauses off-screen.
(function () {
  "use strict";

  var canvas = document.getElementById("hologram");
  if (!canvas) return;
  var ctx = canvas.getContext("2d");
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---- Icosahedron geometry ---- */
  var t = (1 + Math.sqrt(5)) / 2;
  var V = [
    [-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0],
    [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t],
    [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]
  ];
  var FACES = [
    [0,11,5],[0,5,1],[0,1,7],[0,7,10],[0,10,11],
    [1,5,9],[5,11,4],[11,10,2],[10,7,6],[7,1,8],
    [3,9,4],[3,4,2],[3,2,6],[3,6,8],[3,8,9],
    [4,9,5],[2,4,11],[6,2,10],[8,6,7],[9,8,1]
  ];
  // normalise to unit sphere
  V = V.map(function (p) {
    var l = Math.hypot(p[0], p[1], p[2]);
    return [p[0] / l, p[1] / l, p[2] / l];
  });
  // unique edges from faces
  var EDGES = (function () {
    var seen = {}, out = [];
    FACES.forEach(function (f) {
      [[f[0], f[1]], [f[1], f[2]], [f[2], f[0]]].forEach(function (e) {
        var k = Math.min(e[0], e[1]) + "-" + Math.max(e[0], e[1]);
        if (!seen[k]) { seen[k] = 1; out.push(e); }
      });
    });
    return out;
  })();

  /* ---- Theme colours (Aurora is always dark — glowing champagne) ---- */
  function palette() {
    return { line: [199, 162, 94], glow: 16, lineW: 1.1, edgeA: 0.85, vertA: 1, comp: "lighter", scan: 0.06 };
  }
  function isAurora() { return document.documentElement.getAttribute("data-theme") === "aurora"; }

  /* ---- Sizing ---- */
  var W = 0, H = 0, R = 0, cx = 0, cy = 0, dpr = 1;
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    var rect = canvas.getBoundingClientRect();
    W = rect.width; H = rect.height;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    R = Math.min(W, H) * 0.34;
    cx = W / 2; cy = H / 2;
  }

  /* ---- Rotation + projection ---- */
  var ax = -0.35, ay = 0, scanY = 0;
  var FOV = 3.2;

  function project(p) {
    // rotate Y then X
    var cosY = Math.cos(ay), sinY = Math.sin(ay);
    var x1 = p[0] * cosY + p[2] * sinY;
    var z1 = -p[0] * sinY + p[2] * cosY;
    var cosX = Math.cos(ax), sinX = Math.sin(ax);
    var y2 = p[1] * cosX - z1 * sinX;
    var z2 = p[1] * sinX + z1 * cosX;
    var s = FOV / (FOV + z2);
    return { x: cx + x1 * R * s, y: cy + y2 * R * s, z: z2, s: s };
  }

  function frame() {
    var pal = palette();
    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = pal.comp;

    var pts = V.map(project);

    // edges — depth-sorted so nearer lines read brighter
    EDGES.map(function (e) {
      return { e: e, z: (pts[e[0]].z + pts[e[1]].z) / 2 };
    }).sort(function (a, b) { return a.z - b.z; }).forEach(function (o) {
      var a = pts[o.e[0]], b = pts[o.e[1]];
      var depth = (o.z + 1.2) / 2.4;            // 0 (back) .. 1 (front)
      var alpha = pal.edgeA * (0.28 + 0.72 * depth);
      ctx.strokeStyle = "rgba(" + pal.line[0] + "," + pal.line[1] + "," + pal.line[2] + "," + alpha.toFixed(3) + ")";
      ctx.lineWidth = pal.lineW * (0.6 + 0.6 * depth);
      ctx.shadowColor = "rgba(" + pal.line[0] + "," + pal.line[1] + "," + pal.line[2] + ",0.9)";
      ctx.shadowBlur = pal.glow * depth;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    });

    // vertices
    ctx.shadowBlur = pal.glow;
    pts.forEach(function (p) {
      var depth = (p.z + 1.2) / 2.4;
      ctx.fillStyle = "rgba(" + pal.line[0] + "," + pal.line[1] + "," + pal.line[2] + "," + (pal.vertA * (0.3 + 0.7 * depth)).toFixed(3) + ")";
      ctx.beginPath();
      ctx.arc(p.x, p.y, (0.9 + 1.6 * depth) * p.s, 0, Math.PI * 2);
      ctx.fill();
    });

    // hologram scan sweep
    ctx.shadowBlur = 0;
    var band = H * 0.14;
    var y = (scanY % (H + band)) - band;
    var g = ctx.createLinearGradient(0, y, 0, y + band);
    g.addColorStop(0, "rgba(" + pal.line[0] + "," + pal.line[1] + "," + pal.line[2] + ",0)");
    g.addColorStop(0.5, "rgba(" + pal.line[0] + "," + pal.line[1] + "," + pal.line[2] + "," + pal.scan + ")");
    g.addColorStop(1, "rgba(" + pal.line[0] + "," + pal.line[1] + "," + pal.line[2] + ",0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, y, W, band);

    ctx.globalCompositeOperation = "source-over";
  }

  /* ---- Loop control ---- */
  var running = false, raf = 0, inView = true;
  function tick() {
    if (!reduce) { ay += 0.0032; ax = -0.35 + Math.sin(ay * 0.4) * 0.18; scanY += H * 0.0035; }
    frame();
    if (!reduce && running && inView && !document.hidden && isAurora()) raf = requestAnimationFrame(tick);
    else running = false;
  }
  function start() {
    if (running || !isAurora()) return;
    if (reduce) { resize(); frame(); return; } // static frame, no loop
    running = true; raf = requestAnimationFrame(tick);
  }
  function stop() { running = false; if (raf) cancelAnimationFrame(raf); ctx.clearRect(0, 0, W, H); }

  /* ---- Wire up ---- */
  resize();
  canvas.classList.add("is-ready");
  if (isAurora()) { frame(); start(); } // only draw when Aurora is active

  window.addEventListener("resize", function () { resize(); if (isAurora()) frame(); });
  document.addEventListener("visibilitychange", function () { if (!document.hidden) start(); });

  // pause when hero scrolls out of view
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (es) {
      inView = es[0].isIntersecting;
      if (inView) start();
    }, { threshold: 0.01 }).observe(canvas);
  }

  // start/stop instantly on theme toggle
  new MutationObserver(function () {
    if (isAurora()) { resize(); frame(); start(); } else { stop(); }
  }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
})();
