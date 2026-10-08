// The Human Mastery Architecture — "Anima" option (Three.js + real GLB human)
// Loads a rigged humanoid (Xbot mannequin), poses it to its idle standing frame,
// bakes the skinned mesh, then renders it as additive glowing points + a
// low-poly wireframe through an UnrealBloom pass. Three.js + the model load
// ONLY when Anima is first selected. Respects reduced-motion; pauses off-screen.
//
// Model: "Xbot" — Mixamo (Adobe) mannequin, as shipped with three.js examples.
// Mixamo assets are royalty-free for use; confirm licensing before production.
(function () {
  "use strict";

  var MODEL_URL = "models/Xbot.glb";
  var canvas = document.getElementById("anima3d");
  if (!canvas) return;
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  function isAnima() { return document.documentElement.getAttribute("data-theme") === "anima"; }

  var booting = false, ready = false, running = false, failed = false;
  var THREE, renderer, scene, camera, composer, group, clock;
  var rafId = 0, inView = true;

  async function boot() {
    if (booting || ready || failed) return;
    booting = true;
    try {
      THREE = await import("three");
      var GLTF   = await import("three/addons/loaders/GLTFLoader.js");
      var Samp   = await import("three/addons/math/MeshSurfaceSampler.js");
      var BGU    = await import("three/addons/utils/BufferGeometryUtils.js");
      var Simp   = await import("three/addons/modifiers/SimplifyModifier.js");
      var EC     = await import("three/addons/postprocessing/EffectComposer.js");
      var RP     = await import("three/addons/postprocessing/RenderPass.js");
      var Bloom  = await import("three/addons/postprocessing/UnrealBloomPass.js");

      initRenderer();
      var bodyGeo = await loadAndBake(GLTF.GLTFLoader, BGU);
      buildVisual(bodyGeo, Samp.MeshSurfaceSampler, Simp.SimplifyModifier);
      buildComposer(EC.EffectComposer, RP.RenderPass, Bloom.UnrealBloomPass);

      ready = true;
      canvas.classList.add("is-ready");
      resize();
      start();
    } catch (e) {
      failed = true;
      if (window.console) console.warn("[HMA] Anima 3D unavailable:", e);
    } finally {
      booting = false;
    }
  }

  function initRenderer() {
    renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true });
    renderer.setClearColor(0x000000, 1); // opaque black; hero bg matched to black
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
    camera.position.set(0, 0.0, 6.6);

    group = new THREE.Group();
    scene.add(group);
    clock = new THREE.Clock();
  }

  // Load GLB, pose to idle, bake every skinned mesh into one static geometry.
  async function loadAndBake(GLTFLoader, BGU) {
    var loader = new GLTFLoader();
    var gltf = await loader.loadAsync(MODEL_URL);
    var model = gltf.scene;
    scene.add(model);           // must be in-scene for world matrices
    model.visible = false;      // we only render the baked points, not the mesh
    model.updateMatrixWorld(true);

    // pose to the idle standing frame (arms down, natural stance)
    var idle = (THREE.AnimationClip.findByName(gltf.animations, "idle")) || gltf.animations[0];
    if (idle) {
      var mixer = new THREE.AnimationMixer(model);
      var action = mixer.clipAction(idle);
      action.play();
      mixer.update(0.0);
      model.updateMatrixWorld(true);
    }

    var v = new THREE.Vector3();
    var baked = [];
    model.traverse(function (o) {
      if (!o.isSkinnedMesh) return;
      o.skeleton.update();
      var g = o.geometry;
      var pos = g.attributes.position;
      var arr = new Float32Array(pos.count * 3);
      for (var i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i);
        o.applyBoneTransform(i, v);     // posed, in mesh-local space
        v.applyMatrix4(o.matrixWorld);  // -> world space
        arr[i * 3] = v.x; arr[i * 3 + 1] = v.y; arr[i * 3 + 2] = v.z;
      }
      var bg = new THREE.BufferGeometry();
      bg.setAttribute("position", new THREE.BufferAttribute(arr, 3));
      if (g.index) bg.setIndex(g.index.clone());
      baked.push(bg);
    });

    scene.remove(model);

    var bodyGeo = baked.length > 1 ? BGU.mergeGeometries(baked, false) : baked[0];

    // centre at origin and normalise height
    bodyGeo.computeBoundingBox();
    var bb = bodyGeo.boundingBox;
    var cx = (bb.min.x + bb.max.x) / 2;
    var cyc = (bb.min.y + bb.max.y) / 2;
    var cz = (bb.min.z + bb.max.z) / 2;
    bodyGeo.translate(-cx, -cyc, -cz);
    var h = bb.max.y - bb.min.y || 1;
    var target = 3.3;
    bodyGeo.scale(target / h, target / h, target / h);
    return bodyGeo;
  }

  function buildVisual(bodyGeo, MeshSurfaceSampler, SimplifyModifier) {
    // --- low-poly wireframe (simplified for the faceted hologram look) ---
    try {
      var vCount = bodyGeo.attributes.position.count;
      var keep = 900;
      var remove = Math.max(0, vCount - keep);
      var low = new SimplifyModifier().modify(bodyGeo, remove);
      var wire = new THREE.LineSegments(
        new THREE.WireframeGeometry(low),
        new THREE.LineBasicMaterial({
          color: 0x58a6ff, transparent: true, opacity: 0.16,
          blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false
        })
      );
      group.add(wire);
    } catch (e) {
      if (window.console) console.warn("[HMA] wireframe simplify skipped:", e);
    }

    // --- surface points ---
    var mesh = new THREE.Mesh(bodyGeo, new THREE.MeshBasicMaterial());
    var sampler = new MeshSurfaceSampler(mesh).build();
    var N = 16000;
    var pos = new Float32Array(N * 3);
    var tmp = new THREE.Vector3();
    for (var i = 0; i < N; i++) {
      sampler.sample(tmp);
      pos[i * 3] = tmp.x; pos[i * 3 + 1] = tmp.y; pos[i * 3 + 2] = tmp.z;
    }
    var pgeo = new THREE.BufferGeometry();
    pgeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));

    var pts = new THREE.Points(pgeo, new THREE.PointsMaterial({
      color: 0x7cbaff, size: 0.028, map: dotTexture(), sizeAttenuation: true,
      transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending,
      depthWrite: false, depthTest: false
    }));
    group.add(pts);
  }

  function buildComposer(EffectComposer, RenderPass, UnrealBloomPass) {
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    var bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 1.0, 0.5, 0.0);
    composer.addPass(bloom);
    composer.__bloom = bloom;
  }

  function dotTexture() {
    var c = document.createElement("canvas"); c.width = c.height = 64;
    var g = c.getContext("2d");
    var rg = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    rg.addColorStop(0, "rgba(255,255,255,1)");
    rg.addColorStop(0.25, "rgba(200,228,255,0.95)");
    rg.addColorStop(0.6, "rgba(96,164,255,0.35)");
    rg.addColorStop(1, "rgba(64,132,255,0)");
    g.fillStyle = rg; g.fillRect(0, 0, 64, 64);
    var tex = new THREE.Texture(c); tex.needsUpdate = true; return tex;
  }

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

  function render() {
    var t = clock.getElapsedTime();
    if (!reduce) {
      group.rotation.y = Math.sin(t * 0.16) * 0.45;
      group.position.y = Math.sin(t * 0.7) * 0.05;
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
