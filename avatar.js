'use strict';
/* ================================================================
   NUMERA — the Mathfinder (Three.js) + level-up ceremony
   Two character sources:
     1. A real rigged glTF at <NUMERA_ASSETS>/mathfinder.glb with
        clips named like idle / walk / celebrate (Mixamo exports
        work). Loaded when available; scenes swap it in live.
     2. A procedural articulated humanoid built from primitives
        (always available; ships inside the single-file build).
   ================================================================ */
window.NumeraAvatar = (function () {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let renderer = null, scene, camera, rig = null, running = false, celebrateT = 0;
  let gltf = null, loading = false; const modelListeners = [];

  const C = {
    skin: 0xf3cfae, hair: 0x8a4a22, hairDark: 0x6d3717, jacket: 0xf6f3ee, jacketShade: 0xe4dfd6,
    trim: 0x6d52d8, legs: 0x1c1c26, shoe: 0xf4f2ef, pack: 0x3a3f5e, glove: 0x2a2a36, eye: 0x1c2a44, gold: 0xf2c14e, glow: 0xffe9a8,
  };
  const mat = (color, extra) => new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.75, metalness: 0.02 }, extra || {}));
  function mesh(geo, m, x, y, z, parent) {
    const o = new THREE.Mesh(geo, m); o.position.set(x || 0, y || 0, z || 0); o.castShadow = true;
    if (parent) parent.add(o); return o;
  }
  const env = (x, a, b) => { const t = THREE.MathUtils.clamp((x - a) / (b - a), 0, 1); return Math.sin(t * Math.PI); }; // 0→1→0 bump

  /* ---------- glTF character ---------- */
  function loadModel(url) {
    if (!window.THREE || !THREE.GLTFLoader || gltf || loading) return;
    loading = true;
    new THREE.GLTFLoader().load(url, g => {
      gltf = g; loading = false; modelListeners.forEach(cb => { try { cb(); } catch (e) { } });
    }, undefined, () => { loading = false; /* no model shipped — procedural stays */ });
  }
  function onModel(cb) { modelListeners.push(cb); if (gltf) cb(); }
  function buildGltfRig(opts) {
    const g = new THREE.Group();
    const model = THREE.SkeletonUtils ? THREE.SkeletonUtils.clone(gltf.scene) : gltf.scene.clone(true);
    const box = new THREE.Box3().setFromObject(model), size = box.getSize(new THREE.Vector3());
    const s = 1.8 / (size.y || 1); model.scale.setScalar(s);
    model.position.y = -box.min.y * s;
    model.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = false; } });
    g.add(model);
    const mixer = new THREE.AnimationMixer(model);
    const find = re => gltf.animations.find(c => re.test(c.name));
    const idleC = find(/idle|stand|breath/i) || gltf.animations[0], walkC = find(/walk|run|jog/i), celC = find(/jump|dance|cheer|wave|celebr|victory/i);
    const idle = idleC ? mixer.clipAction(idleC) : null, walk = walkC ? mixer.clipAction(walkC) : null, cel = celC ? mixer.clipAction(celC) : null;
    if (idle) idle.play(); if (walk) { walk.play(); walk.setEffectiveWeight(0); }
    const lantern = new THREE.Group(); lantern.position.set(0.35, 0.95, 0.2);
    const light = new THREE.PointLight(C.gold, opts.lightIntensity === undefined ? 0.9 : opts.lightIntensity, 4); lantern.add(light);
    mesh(new THREE.SphereGeometry(0.05, 10, 10), new THREE.MeshBasicMaterial({ color: C.glow }), 0, 0, 0, lantern);
    g.add(lantern);
    const r = { g, lantern, light, stars: null, arms: null, eyes: null, isGltf: true, celebrating: 0 };
    r.animate = function (s, speed, dt) {
      mixer.update(dt || 0.016);
      if (idle) idle.setEffectiveWeight(1 - (speed || 0)); if (walk) walk.setEffectiveWeight(speed || 0);
      light.intensity = (opts.lightIntensity === undefined ? 0.9 : opts.lightIntensity) * (1 + Math.sin(s * 3.2) * 0.1);
    };
    r.celebrate = function () { if (cel) { cel.reset().setLoop(THREE.LoopOnce, 1).play(); if (idle) idle.crossFadeTo(cel, 0.2, false); setTimeout(() => { if (idle) idle.reset().play(); }, (celC.duration || 2) * 1000); } };
    return r;
  }

  /* ---------- procedural character ---------- */
  function buildProceduralRig(opts) {
    const g = new THREE.Group();
    const mSkin = mat(C.skin), mHair = mat(C.hair, { roughness: 0.55 }), mJacket = mat(C.jacket, { roughness: 0.85 });
    const mTrim = mat(C.trim, { roughness: 0.6 }), mLegs = mat(C.legs, { roughness: 0.9 }), mPack = mat(C.pack, { roughness: 0.9 });
    const mShoe = mat(C.shoe), mGlove = mat(C.glove);

    // legs (pivot at hip) — tapered lathe profiles
    const legProfile = new THREE.LatheGeometry([new THREE.Vector2(0.001, 0), new THREE.Vector2(0.1, 0), new THREE.Vector2(0.095, -0.2), new THREE.Vector2(0.075, -0.44), new THREE.Vector2(0.07, -0.62), new THREE.Vector2(0.062, -0.84), new THREE.Vector2(0.001, -0.86)], 18);
    const legs = [-1, 1].map(side => {
      const hip = new THREE.Group(); hip.position.set(side * 0.11, 0.92, 0);
      mesh(legProfile, mLegs, 0, 0, 0, hip);
      mesh(new THREE.BoxGeometry(0.15, 0.1, 0.3), mShoe, 0, -0.88, 0.05, hip);
      mesh(new THREE.BoxGeometry(0.155, 0.035, 0.31), mTrim, 0, -0.9, 0.05, hip);
      mesh(new THREE.SphereGeometry(0.075, 12, 10), mShoe, 0, -0.86, 0.19, hip).scale.set(1, 0.7, 1);
      g.add(hip); return hip;
    });
    // torso — a lathe-profiled jacket with waist, chest and shoulders
    const torso = new THREE.Group(); torso.position.y = 0.92; g.add(torso);
    const jacketProfile = new THREE.LatheGeometry([new THREE.Vector2(0.19, 0), new THREE.Vector2(0.22, 0.1), new THREE.Vector2(0.235, 0.24), new THREE.Vector2(0.26, 0.42), new THREE.Vector2(0.27, 0.56), new THREE.Vector2(0.24, 0.66), new THREE.Vector2(0.13, 0.72), new THREE.Vector2(0.09, 0.73)], 28);
    mesh(jacketProfile, mJacket, 0, 0, 0, torso);
    mesh(new THREE.CylinderGeometry(0.2, 0.19, 0.12, 24), mLegs, 0, 0.02, 0, torso);
    mesh(new THREE.TorusGeometry(0.19, 0.045, 10, 26), mTrim, 0, 0.72, 0, torso).rotation.x = Math.PI / 2; // collar
    mesh(new THREE.TorusGeometry(0.2, 0.018, 8, 28), mTrim, 0, 0.03, 0, torso).rotation.x = Math.PI / 2;  // hem
    mesh(new THREE.BoxGeometry(0.025, 0.5, 0.02), mat(C.jacketShade), 0, 0.4, 0.255, torso);           // zip
    [-1, 1].forEach(s => mesh(new THREE.BoxGeometry(0.12, 0.16, 0.03), mat(C.jacketShade), s * 0.16, 0.22, 0.24, torso).rotation.z = s * 0.08); // pockets
    mesh(new THREE.SphereGeometry(0.17, 18, 14), mJacket, 0, 0.72, -0.16, torso).scale.set(1.25, 0.6, 0.85); // bunched hood
    mesh(new THREE.BoxGeometry(0.34, 0.42, 0.18), mPack, 0, 0.42, -0.33, torso);
    mesh(new THREE.BoxGeometry(0.28, 0.13, 0.11), mPack, 0, 0.18, -0.37, torso);
    mesh(new THREE.BoxGeometry(0.2, 0.05, 0.19), mat(0x2c3050), 0, 0.64, -0.33, torso);
    [-1, 1].forEach(s => mesh(new THREE.BoxGeometry(0.05, 0.44, 0.03), mPack, s * 0.14, 0.46, 0.25, torso));
    // arms (pivot at shoulder)
    const arms = [-1, 1].map(side => {
      const sh = new THREE.Group(); sh.position.set(side * 0.3, 1.58, 0);
      mesh(new THREE.SphereGeometry(0.09, 14, 12), mJacket, 0, 0, 0, sh);
      mesh(new THREE.CylinderGeometry(0.078, 0.066, 0.3, 16), mJacket, 0, -0.17, 0, sh);
      mesh(new THREE.SphereGeometry(0.066, 12, 10), mJacket, 0, -0.34, 0, sh);
      mesh(new THREE.CylinderGeometry(0.062, 0.056, 0.28, 16), mJacket, 0, -0.49, 0, sh);
      mesh(new THREE.TorusGeometry(0.056, 0.015, 8, 16), mTrim, 0, -0.62, 0, sh).rotation.x = Math.PI / 2;
      mesh(new THREE.SphereGeometry(0.066, 14, 12), mGlove, 0, -0.68, 0, sh);
      sh.rotation.z = side * 0.08; g.add(sh); return sh;
    });
    // head, face
    const head = new THREE.Group(); head.position.y = 1.72; g.add(head);
    mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.12, 14), mSkin, 0, -0.1, 0, head);
    mesh(new THREE.SphereGeometry(0.235, 30, 24), mSkin, 0, 0.1, 0, head).scale.set(1, 1.08, 0.98);
    mesh(new THREE.SphereGeometry(0.04, 10, 8), mSkin, 0.24, 0.07, 0, head).scale.set(0.5, 1, 0.8); // ears
    mesh(new THREE.SphereGeometry(0.04, 10, 8), mSkin, -0.24, 0.07, 0, head).scale.set(0.5, 1, 0.8);
    const eyes = new THREE.Group(); head.add(eyes);
    [-1, 1].forEach(s => {
      mesh(new THREE.SphereGeometry(0.04, 12, 10), mat(0xffffff, { roughness: 0.3 }), s * 0.085, 0.09, 0.2, eyes).scale.set(1, 1.15, 0.5);
      mesh(new THREE.SphereGeometry(0.024, 12, 10), mat(C.eye, { roughness: 0.2 }), s * 0.085, 0.09, 0.225, eyes).scale.set(1, 1.2, 0.5);
      mesh(new THREE.SphereGeometry(0.009, 8, 6), mat(0xffffff), s * 0.095, 0.1, 0.242, eyes);
      mesh(new THREE.BoxGeometry(0.08, 0.014, 0.02), mHair, s * 0.085, 0.16, 0.215, eyes).rotation.z = -s * 0.15;
    });
    mesh(new THREE.SphereGeometry(0.03, 10, 8), mat(0xd98f7a), 0, -0.01, 0.235, head).scale.set(1, 0.55, 0.6);
    // hair: cap + curved wind-swept strands
    const hair = new THREE.Group(); head.add(hair);
    mesh(new THREE.SphereGeometry(0.25, 28, 22, 0, Math.PI * 2, 0, Math.PI * 0.58), mHair, 0, 0.13, -0.01, hair);
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2 + 0.2, out = 0.14, up = 0.22 + (i % 3) * 0.04;
      const base = new THREE.Vector3(Math.sin(a) * out, 0.2 + Math.cos(a) * 0.04, Math.cos(a) * out - 0.02);
      const tip = base.clone().add(new THREE.Vector3(Math.sin(a) * 0.22, up, Math.cos(a) * 0.22 - 0.12));
      const ctrl = base.clone().lerp(tip, 0.5).add(new THREE.Vector3(0, 0.12, -0.04));
      const curve = new THREE.QuadraticBezierCurve3(base, ctrl, tip);
      const strand = mesh(new THREE.TubeGeometry(curve, 6, 0.045, 7, false), i % 4 === 0 ? mat(C.hairDark) : mHair, 0, 0, 0, hair);
      mesh(new THREE.SphereGeometry(0.045, 8, 6), strand.material, tip.x, tip.y, tip.z, hair);
    }
    mesh(new THREE.ConeGeometry(0.06, 0.24, 8), mHair, 0.03, 0.15, 0.2, hair).rotation.x = 1.15;
    // lantern in the left hand
    const lantern = new THREE.Group();
    mesh(new THREE.OctahedronGeometry(0.11), new THREE.MeshBasicMaterial({ color: C.gold, wireframe: true }), 0, 0, 0, lantern);
    mesh(new THREE.SphereGeometry(0.06, 12, 12), new THREE.MeshBasicMaterial({ color: C.glow }), 0, 0, 0, lantern);
    mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.16, 6), mat(C.gold, { metalness: 0.6, roughness: 0.3 }), 0, 0.15, 0, lantern);
    const light = new THREE.PointLight(C.gold, opts.lightIntensity === undefined ? 0.9 : opts.lightIntensity, 4);
    lantern.add(light); lantern.position.set(0, -0.86, 0.06); arms[0].add(lantern);
    // optional star orbit (portrait)
    let stars = null;
    if (opts.stars) {
      const geo = new THREE.BufferGeometry(), pos = new Float32Array(42 * 3);
      for (let i = 0; i < 42; i++) { const a = Math.random() * Math.PI * 2, r = 0.9 + Math.random() * 0.9; pos[i * 3] = Math.cos(a) * r; pos[i * 3 + 1] = 0.2 + Math.random() * 1.9; pos[i * 3 + 2] = Math.sin(a) * r; }
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      stars = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xede6d3, size: 0.035, transparent: true, opacity: 0.85 })); g.add(stars);
    }
    const r = { g, torso, head, eyes, arms, legs, lantern, light, stars, phase: 0, isGltf: false };
    r.animate = function (s, speed, dt) {
      speed = speed || 0; dt = dt || 0.016;
      r.phase += (1.0 + speed * 5.6) * dt;
      const p = r.phase, w = Math.sin(p * 6.2), w2 = Math.sin(p * 6.2 + Math.PI), swing = 0.62 * speed, idle = 1 - speed;
      legs[0].rotation.x = w * swing; legs[1].rotation.x = w2 * swing;
      // idle emotes: look around, raise the lantern to peer ahead
      const look = env(s % 9, 2.2, 4.6) * idle, raise = env(s % 13, 6, 8.2) * idle;
      arms[0].rotation.x = w2 * swing * 0.8 + 0.25 * speed - raise * 1.4; arms[1].rotation.x = w * swing * 0.8;
      arms[0].rotation.z = -0.08 - speed * 0.15 - raise * 0.25; arms[1].rotation.z = 0.08 + Math.sin(s * 1.2) * 0.03;
      torso.rotation.y = w * 0.08 * speed; torso.rotation.x = 0.04 * speed;
      torso.position.y = 0.92 + Math.abs(Math.sin(p * 6.2)) * 0.035 * speed + Math.sin(s * 1.6) * 0.006;
      head.position.y = 1.72 + torso.position.y - 0.92;
      head.rotation.y = Math.sin(s * 0.7) * 0.06 * idle + Math.sin(s * 2.4) * 0.45 * look;
      head.rotation.x = -0.04 + Math.sin(s * 1.6) * 0.01 - raise * 0.12;
      eyes.scale.y = (s % 3.9) > 3.75 ? 0.1 : 1;
      lantern.rotation.z = Math.sin(s * 2.1) * 0.12;
      light.intensity = (opts.lightIntensity === undefined ? 0.9 : opts.lightIntensity) * (1 + Math.sin(s * 3.2) * 0.1 + raise * 0.6);
      if (stars) stars.rotation.y = s * 0.12;
    };
    r.celebrate = function () { };
    return r;
  }
  function buildCharacter(opts) { opts = opts || {}; return gltf ? buildGltfRig(opts) : buildProceduralRig(opts); }

  /* ---------- portrait scene (title screen, level-up) ---------- */
  function build() {
    if (renderer || !window.THREE) return;
    try { renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true }); } catch (e) { renderer = null; return; }
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    renderer.outputEncoding = THREE.sRGBEncoding; renderer.toneMapping = THREE.ACESFilmicToneMapping;
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50); camera.position.set(0.25, 1.2, 3.5); camera.lookAt(0, 0.95, 0);
    scene.add(new THREE.HemisphereLight(0xdfe9ff, 0x3a3f66, 1.1));
    const key = new THREE.DirectionalLight(0xfff1dc, 1.6); key.position.set(2.5, 4, 3); scene.add(key);
    const rim = new THREE.DirectionalLight(0x8b7cf6, 0.8); rim.position.set(-3, 2, -2); scene.add(rim);
    rig = buildCharacter({ stars: true }); scene.add(rig.g);
    onModel(() => { if (rig) { scene.remove(rig.g); rig = buildCharacter({ stars: true }); scene.add(rig.g); } });
  }
  let lastT = 0;
  function frame(t) {
    if (!rig) return;
    const s = t / 1000, dt = lastT ? Math.min(0.05, (t - lastT) / 1000) : 0.016; lastT = t;
    let spin = Math.sin(s * 0.5) * 0.35, y = 0, flare = 1, sScale = 1;
    rig.animate(s, 0, dt);
    if (celebrateT) {
      const p = (t - celebrateT) / 2400;
      if (p >= 1) celebrateT = 0;
      else {
        const e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
        spin += e * Math.PI * 4; y += Math.sin(p * Math.PI) * 0.5; flare = 1 + Math.sin(p * Math.PI) * 2.2; sScale = 1 + Math.sin(p * Math.PI) * 0.6;
        if (rig.arms) rig.arms[1].rotation.x = -2.6 * Math.sin(p * Math.PI);
      }
    }
    rig.g.rotation.y = spin; rig.g.position.y = y; rig.light.intensity *= flare;
    if (rig.stars) rig.stars.scale.setScalar(sScale);
    renderer.render(scene, camera);
  }
  function loop(t) { if (!running) return; frame(t); requestAnimationFrame(loop); }
  function mount(container, size) {
    if (!container) return;
    build();
    if (!renderer) { container.style.display = 'none'; return; }
    container.style.display = '';
    renderer.setSize(size, size); camera.aspect = 1; camera.updateProjectionMatrix();
    container.innerHTML = ''; container.appendChild(renderer.domElement);
    if (reduced) { frame(1200); return; }
    if (!running) { running = true; requestAnimationFrame(loop); }
  }
  function celebrate() { if (!reduced) { celebrateT = performance.now(); if (rig && rig.celebrate) rig.celebrate(); } }

  /* ---------- level-up ceremony ---------- */
  let lfDone = null;
  function particleBurst() {
    const c = document.getElementById('lfParticles'); if (!c || reduced) return;
    const ctx = c.getContext('2d'); c.width = innerWidth; c.height = innerHeight;
    const cx = c.width / 2, cy = c.height / 2, colors = ['#f2c14e', '#ffe9a8', '#45d6b5', '#ede6d3', '#8b7cf6'], ps = [];
    for (let i = 0; i < 110; i++) { const a = Math.random() * Math.PI * 2, v = 3 + Math.random() * 9; ps.push({ x: cx, y: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 2, r: 1.5 + Math.random() * 3.5, c: colors[i % colors.length] }); }
    const t0 = performance.now();
    (function tick(t) {
      const age = (t - t0) / 1900; ctx.clearRect(0, 0, c.width, c.height);
      if (age >= 1 || document.getElementById('levelfx').hidden) return;
      for (const p of ps) { p.x += p.vx; p.y += p.vy; p.vy += 0.12; p.vx *= 0.985; ctx.globalAlpha = Math.max(0, 1 - age); ctx.fillStyle = p.c; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill(); }
      ctx.globalAlpha = 1; requestAnimationFrame(tick);
    })(t0);
  }
  function levelUp(level, title, onDone) {
    const fx = document.getElementById('levelfx');
    document.getElementById('lfNum').textContent = level; document.getElementById('lfTitle').textContent = title;
    fx.hidden = false; mount(document.getElementById('lfAvatar'), 240); celebrate(); particleBurst();
    lfDone = onDone || null; document.getElementById('lfBtn').focus();
  }
  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('lfBtn').addEventListener('click', () => { document.getElementById('levelfx').hidden = true; if (lfDone) { const f = lfDone; lfDone = null; f(); } });
  });
  if (window.NUMERA_ASSETS) loadModel(window.NUMERA_ASSETS + 'mathfinder.glb');

  return { mount, celebrate, levelUp, buildCharacter, loadModel, onModel, get ready() { build(); return !!renderer; }, get hasModel() { return !!gltf; } };
})();
