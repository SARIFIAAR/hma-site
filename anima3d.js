// The Human Mastery Architecture — "Anima" option (Three.js)
// A glowing low-poly human: merged-primitive body surface-sampled into additive
// points + a low-poly wireframe, with an UnrealBloom pass. Three.js is loaded
// ONLY when Anima is first selected (dynamic import) so the other options stay
// light. Respects reduced-motion; pauses off-screen / when the tab is hidden.
(function () {
  "use strict";

  var canvas = document.getElementById("anima3d");
  if (!canvas) return;
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  function isAnima() { return document.documentElement.getAttribute("data-theme") === "anima"; }

  var booting = false, ready = false, running = false, failed = false;
  var THREE, renderer, scene, camera, composer, group, points, clock;
  var rafId = 0, inView = true;

  /* ---- Lazy boot: pull Three.js only when Anima is actually shown ---- */
  async function boot() {
    if (booting || ready || failed) return;
    booting = true;
    try {
      THREE = await import("three");
      var sampMod = await import("three/addons/math/MeshSurfaceSampler.js");
      var bguMod  = await import("three/addons/utils/BufferGeometryUtils.js");
      var ecMod   = await import("three/addons/postprocessing/EffectComposer.js");
      var rpMod   = await import("three/addons/postprocessing/RenderPass.js");
      var bloomMod= await import("three/addons/postprocessing/UnrealBloomPass.js");
      build(sampMod.MeshSurfaceSampler, bguMod, ecMod.EffectComposer, rpMod.RenderPass, bloomMod.UnrealBloomPass);
      ready = true;
      canvas.classList.add("is-ready");
      resize();
      start();
    } catch (e) {
      failed = true;
      // graceful: leave the hero clean if the CDN/module fails
      if (window.console) console.warn("[HMA] Anima 3D unavailable:", e);
    } finally {
      booting = false;
    }
  }

  /* ---- Build the figure ---- */
  function build(MeshSurfaceSampler, BGU, EffectComposer, RenderPass, UnrealBloomPass) {
    renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    camera.position.set(0, 0.1, 7.6);

    group = new THREE.Group();
    scene.add(group);

    // --- assemble body from capsules + a head sphere ---
    var parts = [];
    function capsule(x1, y1, z1, x2, y2, z2, r) {
      var a = new THREE.Vector3(x1, y1, z1), b = new THREE.Vector3(x2, y2, z2);
      var dir = new THREE.Vector3().subVectors(b, a);
      var len = dir.length();
      var geo = new THREE.CapsuleGeometry(r, len, 5, 12);
      var q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
      var m = new THREE.Matrix4().compose(new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5), q, new THREE.Vector3(1, 1, 1));
      geo.applyMatrix4(m);
      parts.push(geo);
    }
    // head
    var head = new THREE.SphereGeometry(0.34, 18, 16);
    head.translate(0, 2.72, 0);
    parts.push(head);
    // neck, torso, hips
    capsule(0, 2.40, 0, 0, 2.55, 0, 0.12);                 // neck
    capsule(-0.52, 2.34, 0, 0.52, 2.34, 0, 0.14);          // shoulders
    capsule(0, 1.55, 0, 0, 2.34, 0, 0.42);                 // torso
    capsule(0, 1.30, 0, 0, 1.60, 0, 0.40);                 // hips
    // arms (slightly out)
    capsule(-0.52, 2.30, 0, -0.66, 1.75, 0.02, 0.135);     // L upper arm
    capsule(-0.66, 1.75, 0.02, -0.74, 1.20, 0.05, 0.11);   // L forearm
    capsule(0.52, 2.30, 0, 0.66, 1.75, 0.02, 0.135);       // R upper arm
    capsule(0.66, 1.75, 0.02, 0.74, 1.20, 0.05, 0.11);     // R forearm
    var lh = new THREE.SphereGeometry(0.12, 10, 9); lh.translate(-0.76, 1.12, 0.05); parts.push(lh);
    var rh = new THREE.SphereGeometry(0.12, 10, 9); rh.translate(0.76, 1.12, 0.05); parts.push(rh);
    // legs
    capsule(-0.22, 1.45, 0, -0.20, 0.80, 0, 0.18);         // L thigh
    capsule(-0.20, 0.80, 0, -0.18, 0.12, 0.02, 0.135);     // L shin
    capsule(0.22, 1.45, 0, 0.20, 0.80, 0, 0.18);           // R thigh
    capsule(0.20, 0.80, 0, 0.18, 0.12, 0.02, 0.135);       // R shin
    var lf = new THREE.BoxGeometry(0.2, 0.1, 0.34); lf.translate(-0.18, 0.06, 0.1); parts.push(lf);
    var rf = new THREE.BoxGeometry(0.2, 0.1, 0.34); rf.translate(0.18, 0.06, 0.1); parts.push(rf);

    var merged = BGU.mergeGeometries(parts.map(function (g) { return g.toNonIndexed(); }), false);
    merged.computeVertexNormals();
    // centre vertically
    merged.computeBoundingBox();
    var bb = merged.boundingBox;
    var cy = (bb.min.y + bb.max.y) / 2;
    merged.translate(0, -cy, 0);

    // --- low-poly wireframe ---
    var wire = new THREE.LineSegments(
      new THREE.WireframeGeometry(merged),
      new THREE.LineBasicMaterial({ color: 0x3f8cff, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    group.add(wire);

    // --- surface point cloud ---
    var sampleMesh = new THREE.Mesh(merged, new THREE.MeshBasicMaterial());
    var sampler = new MeshSurfaceSampler(sampleMesh).build();
    var N = 9000;
    var pos = new Float32Array(N * 3);
    var sz = new Float32Array(N);
    var tmp = new THREE.Vector3();
    for (var i = 0; i < N; i++) {
      sampler.sample(tmp);
      pos[i * 3] = tmp.x; pos[i * 3 + 1] = tmp.y; pos[i * 3 + 2] = tmp.z;
      sz[i] = 0.6 + Math.random() * 1.6;
    }
    var pgeo = new THREE.BufferGeometry();
    pgeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    pgeo.setAttribute("aSize", new THREE.BufferAttribute(sz, 1));

    points = new THREE.Points(pgeo, new THREE.PointsMaterial({
      color: 0x74b6ff, size: 0.045, map: dotTexture(), sizeAttenuation: true,
      transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending,
      depthWrite: false, depthTest: false
    }));
    group.add(points);

    group.scale.setScalar(1.08);

    // --- bloom pipeline ---
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    var bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 1.15, 0.6, 0.0);
    composer.addPass(bloom);
    composer.__bloom = bloom;

    clock = new THREE.Clock();
  }

  /* ---- soft round sprite for each point ---- */
  function dotTexture() {
    var c = document.createElement("canvas"); c.width = c.height = 64;
    var g = c.getContext("2d");
    var rg = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    rg.addColorStop(0, "rgba(255,255,255,1)");
    rg.addColorStop(0.25, "rgba(190,224,255,0.95)");
    rg.addColorStop(0.6, "rgba(90,160,255,0.35)");
    rg.addColorStop(1, "rgba(60,130,255,0)");
    g.fillStyle = rg; g.fillRect(0, 0, 64, 64);
    var tex = new THREE.Texture(c); tex.needsUpdate = true; return tex;
  }

  /* ---- Sizing ---- */
  function resize() {
    if (!ready) return;
    var rect = canvas.getBoundingClientRect();
    var w = Math.max(1, rect.width), h = Math.max(1, rect.height);
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    if (composer.__bloom) composer.__bloom.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  /* ---- Loop ---- */
  function render() {
    var t = clock.getElapsedTime();
    if (!reduce) {
      group.rotation.y = Math.sin(t * 0.18) * 0.5;          // slow sway, not a full spin
      group.position.y = Math.sin(t * 0.7) * 0.06;
      var s = 1.08 + Math.sin(t * 1.1) * 0.006;             // breathing
      group.scale.setScalar(s);
    }
    composer.render();
  }
  function loop() {
    render();
    if (!reduce && running && inView && !document.hidden && isAnima()) rafId = requestAnimationFrame(loop);
    else running = false;
  }
  function start() {
    if (!ready || running || !isAnima()) return;
    if (reduce) { render(); return; }
    running = true; rafId = requestAnimationFrame(loop);
  }
  function stop() { running = false; if (rafId) cancelAnimationFrame(rafId); }

  /* ---- Wire up ---- */
  if (isAnima()) boot();

  window.addEventListener("resize", function () { if (ready) { resize(); if (!running) render(); } });
  document.addEventListener("visibilitychange", function () { if (!document.hidden) start(); });
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (es) { inView = es[0].isIntersecting; if (inView) start(); },
      { threshold: 0.01 }).observe(canvas);
  }
  new MutationObserver(function () {
    if (isAnima()) { ready ? (resize(), start()) : boot(); } else { stop(); }
  }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
})();
