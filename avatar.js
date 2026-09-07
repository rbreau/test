'use strict';
/* ================================================================
   NUMERA — the Mathfinder (Three.js) + level-up ceremony
   An articulated, smooth-shaded humanoid with a walk cycle: spiky
   hair, hooded jacket, leggings, sneakers, a backpack and the
   brand lantern. Built from primitives so it ships inside one file.
   ================================================================ */
window.NumeraAvatar = (function () {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let renderer = null, scene, camera, rig = null, running = false;
  let celebrateT = 0;

  const C = {
    skin: 0xf3cfae, hair: 0x8a4a22, hairDark: 0x6d3717, jacket: 0xf6f3ee, jacketShade: 0xe4dfd6,
    trim: 0x6d52d8, legs: 0x1c1c26, shoe: 0xf4f2ef, shoeTrim: 0x6d52d8, pack: 0x3a3f5e, glove: 0x2a2a36,
    eye: 0x1c2a44, gold: 0xf2c14e, lanternGlow: 0xffe9a8,
  };
  const mat = (color, extra) => new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.75, metalness: 0.02 }, extra || {}));
  function mesh(geo, m, x, y, z, parent) {
    const o = new THREE.Mesh(geo, m);
    o.position.set(x || 0, y || 0, z || 0);
    o.castShadow = true; o.receiveShadow = false;
    (parent || null) && parent.add(o);
    return o;
  }

  /* Character factory. Returns a rig with limb pivots and an
     animate(t, speed) that plays idle/walk. Height ≈ 1.8 units. */
  function buildCharacter(opts) {
    opts = opts || {};
    const g = new THREE.Group();
    const mSkin = mat(C.skin), mHair = mat(C.hair, { roughness: 0.6 }), mJacket = mat(C.jacket, { roughness: 0.85 });
    const mTrim = mat(C.trim, { roughness: 0.6 }), mLegs = mat(C.legs, { roughness: 0.9 }), mPack = mat(C.pack, { roughness: 0.9 });
    const mShoe = mat(C.shoe), mGlove = mat(C.glove);

    // ---- legs (pivot at hip)
    const legs = [-1, 1].map(side => {
      const hip = new THREE.Group(); hip.position.set(side * 0.11, 0.92, 0);
      mesh(new THREE.CylinderGeometry(0.095, 0.08, 0.44, 18), mLegs, 0, -0.22, 0, hip);
      mesh(new THREE.SphereGeometry(0.08, 14, 12), mLegs, 0, -0.45, 0, hip);
      const shin = mesh(new THREE.CylinderGeometry(0.075, 0.065, 0.4, 18), mLegs, 0, -0.66, 0, hip);
      const shoe = mesh(new THREE.BoxGeometry(0.15, 0.1, 0.3), mShoe, 0, -0.88, 0.05, hip);
      mesh(new THREE.BoxGeometry(0.155, 0.035, 0.31), mTrim, 0, -0.9, 0.05, hip);
      shoe.geometry.translate(0, 0, 0);
      g.add(hip);
      return hip;
    });

    // ---- torso + jacket
    const torso = new THREE.Group(); torso.position.y = 0.92; g.add(torso);
    mesh(new THREE.CylinderGeometry(0.2, 0.17, 0.36, 22), mLegs, 0, 0.18, 0, torso);           // waist band
    const jacket = mesh(new THREE.CylinderGeometry(0.26, 0.24, 0.5, 24), mJacket, 0, 0.42, 0, torso);
    mesh(new THREE.SphereGeometry(0.26, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2), mJacket, 0, 0.67, 0, torso); // shoulders
    mesh(new THREE.TorusGeometry(0.2, 0.05, 10, 24), mTrim, 0, 0.72, 0, torso).rotation.x = Math.PI / 2; // collar
    mesh(new THREE.BoxGeometry(0.03, 0.46, 0.02), mat(C.jacketShade), 0, 0.42, 0.255, torso);       // zip line
    mesh(new THREE.TorusGeometry(0.245, 0.02, 8, 24), mTrim, 0, 0.18, 0, torso).rotation.x = Math.PI / 2; // hem
    // hood bunched at the back
    mesh(new THREE.SphereGeometry(0.17, 18, 14), mJacket, 0, 0.7, -0.17, torso).scale.set(1.2, 0.6, 0.8);
    // backpack
    const pack = mesh(new THREE.BoxGeometry(0.34, 0.4, 0.17), mPack, 0, 0.42, -0.32, torso);
    mesh(new THREE.BoxGeometry(0.26, 0.12, 0.1), mPack, 0, 0.2, -0.36, torso);
    [-1, 1].forEach(s => mesh(new THREE.BoxGeometry(0.05, 0.42, 0.03), mPack, s * 0.14, 0.46, 0.25, torso));
    pack.geometry.translate(0, 0, 0);

    // ---- arms (pivot at shoulder)
    const arms = [-1, 1].map(side => {
      const sh = new THREE.Group(); sh.position.set(side * 0.3, 1.58, 0);
      mesh(new THREE.SphereGeometry(0.085, 14, 12), mJacket, 0, 0, 0, sh);
      mesh(new THREE.CylinderGeometry(0.075, 0.065, 0.3, 16), mJacket, 0, -0.17, 0, sh);
      mesh(new THREE.SphereGeometry(0.065, 12, 10), mJacket, 0, -0.34, 0, sh);
      mesh(new THREE.CylinderGeometry(0.06, 0.055, 0.28, 16), mJacket, 0, -0.49, 0, sh);
      mesh(new THREE.TorusGeometry(0.055, 0.015, 8, 16), mTrim, 0, -0.62, 0, sh).rotation.x = Math.PI / 2;
      mesh(new THREE.SphereGeometry(0.065, 14, 12), mGlove, 0, -0.68, 0, sh);
      sh.rotation.z = side * 0.08;
      g.add(sh);
      return sh;
    });

    // ---- head, face, hair
    const head = new THREE.Group(); head.position.y = 1.72; g.add(head);
    mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.12, 14), mSkin, 0, -0.1, 0, head);
    mesh(new THREE.SphereGeometry(0.235, 28, 22), mSkin, 0, 0.1, 0, head).scale.set(1, 1.08, 1);
    const eyes = new THREE.Group(); head.add(eyes);
    [-1, 1].forEach(s => {
      mesh(new THREE.SphereGeometry(0.04, 12, 10), mat(0xffffff, { roughness: 0.3 }), s * 0.085, 0.09, 0.2, eyes).scale.set(1, 1.15, 0.5);
      mesh(new THREE.SphereGeometry(0.024, 12, 10), mat(C.eye, { roughness: 0.2 }), s * 0.085, 0.09, 0.225, eyes).scale.set(1, 1.2, 0.5);
      mesh(new THREE.BoxGeometry(0.08, 0.014, 0.02), mHair, s * 0.085, 0.16, 0.215, eyes).rotation.z = -s * 0.15; // brows
    });
    mesh(new THREE.SphereGeometry(0.03, 10, 8), mat(0xd98f7a), 0, -0.01, 0.235, head).scale.set(1, 0.6, 0.6); // mouth
    // hair cap + spikes (the wind-swept look)
    const hair = new THREE.Group(); head.add(hair);
    mesh(new THREE.SphereGeometry(0.25, 26, 20, 0, Math.PI * 2, 0, Math.PI * 0.58), mHair, 0, 0.13, -0.01, hair);
    const spikeGeo = new THREE.ConeGeometry(0.075, 0.3, 8);
    for (let i = 0; i < 13; i++) {
      const a = (i / 13) * Math.PI * 2, tilt = 0.55 + (i % 3) * 0.25;
      const sp = mesh(spikeGeo, i % 4 === 0 ? mat(C.hairDark) : mHair, Math.sin(a) * 0.14, 0.24 + Math.cos(a) * 0.05, Math.cos(a) * 0.14 - 0.02, hair);
      sp.rotation.set(Math.cos(a) * tilt, 0, -Math.sin(a) * tilt);
    }
    mesh(new THREE.ConeGeometry(0.06, 0.24, 8), mHair, 0.02, 0.15, 0.2, hair).rotation.x = 1.15; // fringe

    // ---- lantern in the left hand
    const lantern = new THREE.Group();
    const glow = new THREE.MeshBasicMaterial({ color: C.lanternGlow });
    mesh(new THREE.OctahedronGeometry(0.11), new THREE.MeshBasicMaterial({ color: C.gold, wireframe: true }), 0, 0, 0, lantern);
    mesh(new THREE.SphereGeometry(0.06, 12, 12), glow, 0, 0, 0, lantern);
    mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.16, 6), mat(C.gold, { metalness: 0.6, roughness: 0.3 }), 0, 0.15, 0, lantern);
    const light = new THREE.PointLight(C.gold, opts.lightIntensity === undefined ? 0.9 : opts.lightIntensity, 4);
    lantern.add(light);
    lantern.position.set(0, -0.86, 0.06);
    arms[0].add(lantern);

    // ---- optional orbiting stars (portrait scenes)
    let stars = null;
    if (opts.stars) {
      const starGeo = new THREE.BufferGeometry();
      const pos = new Float32Array(42 * 3);
      for (let i = 0; i < 42; i++) {
        const a = Math.random() * Math.PI * 2, r = 0.9 + Math.random() * 0.9, y = 0.2 + Math.random() * 1.9;
        pos[i * 3] = Math.cos(a) * r; pos[i * 3 + 1] = y; pos[i * 3 + 2] = Math.sin(a) * r;
      }
      starGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xede6d3, size: 0.035, transparent: true, opacity: 0.85 }));
      g.add(stars);
    }

    const r = { g, torso, head, eyes, arms, legs, lantern, light, stars, phase: 0 };
    /* animate(t seconds, speed 0..1): idle breathing or a walk cycle */
    r.animate = function (s, speed) {
      speed = speed || 0;
      r.phase += (0.016 + speed * 0.09);
      const p = r.phase, w = Math.sin(p * 6.2), w2 = Math.sin(p * 6.2 + Math.PI);
      const swing = 0.6 * speed;
      legs[0].rotation.x = w * swing; legs[1].rotation.x = w2 * swing;
      arms[0].rotation.x = w2 * swing * 0.8 + 0.25 * speed; arms[1].rotation.x = w * swing * 0.8;
      arms[0].rotation.z = -0.08 - speed * 0.15; arms[1].rotation.z = 0.08 + Math.sin(s * 1.2) * 0.03;
      torso.rotation.y = w * 0.08 * speed;
      torso.position.y = 0.92 + Math.abs(Math.sin(p * 6.2)) * 0.035 * speed + Math.sin(s * 1.6) * 0.006;
      head.position.y = 1.72 + torso.position.y - 0.92;
      head.rotation.y = Math.sin(s * 0.7) * 0.12 * (1 - speed);
      head.rotation.x = -0.04 + Math.sin(s * 1.6) * 0.01;
      eyes.scale.y = (s % 3.9) > 3.75 ? 0.1 : 1;
      lantern.rotation.z = Math.sin(s * 2.1) * 0.12;
      light.intensity = (opts.lightIntensity === undefined ? 0.9 : opts.lightIntensity) * (1 + Math.sin(s * 3.2) * 0.1);
      if (stars) stars.rotation.y = s * 0.12;
    };
    return r;
  }

  /* ---------- portrait scene (title screen, level-up) ---------- */
  function build() {
    if (renderer || !window.THREE) return;
    try { renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true }); }
    catch (e) { renderer = null; return; }
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
    camera.position.set(0.25, 1.2, 3.5);
    camera.lookAt(0, 0.95, 0);
    scene.add(new THREE.HemisphereLight(0xdfe9ff, 0x3a3f66, 1.1));
    const key = new THREE.DirectionalLight(0xfff1dc, 1.6);
    key.position.set(2.5, 4, 3);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x8b7cf6, 0.8);
    rim.position.set(-3, 2, -2);
    scene.add(rim);
    rig = buildCharacter({ stars: true });
    scene.add(rig.g);
  }

  function frame(t) {
    if (!rig) return;
    const s = t / 1000;
    let spin = Math.sin(s * 0.5) * 0.35, y = 0, flare = 1, sScale = 1;
    if (celebrateT) {
      const p = (t - celebrateT) / 2400;
      if (p >= 1) celebrateT = 0;
      else {
        const e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
        spin += e * Math.PI * 4;
        y += Math.sin(p * Math.PI) * 0.5;
        flare = 1 + Math.sin(p * Math.PI) * 2.2;
        sScale = 1 + Math.sin(p * Math.PI) * 0.6;
        rig.arms[1].rotation.x = -2.6 * Math.sin(p * Math.PI); // arm up in triumph
      }
    }
    rig.animate(s, 0);
    rig.g.rotation.y = spin;
    rig.g.position.y = y;
    rig.light.intensity *= flare;
    if (rig.stars) rig.stars.scale.setScalar(sScale);
    renderer.render(scene, camera);
  }
  function loop(t) { if (!running) return; frame(t); requestAnimationFrame(loop); }

  function mount(container, size) {
    if (!container) return;
    build();
    if (!renderer) { container.style.display = 'none'; return; }
    container.style.display = '';
    renderer.setSize(size, size);
    camera.aspect = 1; camera.updateProjectionMatrix();
    container.innerHTML = '';
    container.appendChild(renderer.domElement);
    if (reduced) { frame(1200); return; }
    if (!running) { running = true; requestAnimationFrame(loop); }
  }
  function celebrate() { if (!reduced) celebrateT = performance.now(); }

  /* ---------- level-up ceremony ---------- */
  let lfDone = null;
  function particleBurst() {
    const c = document.getElementById('lfParticles');
    if (!c || reduced) return;
    const ctx = c.getContext('2d');
    c.width = innerWidth; c.height = innerHeight;
    const cx = c.width / 2, cy = c.height / 2;
    const colors = ['#f2c14e', '#ffe9a8', '#45d6b5', '#ede6d3', '#8b7cf6'];
    const ps = [];
    for (let i = 0; i < 110; i++) {
      const a = Math.random() * Math.PI * 2, v = 3 + Math.random() * 9;
      ps.push({ x: cx, y: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 2, r: 1.5 + Math.random() * 3.5, c: colors[i % colors.length] });
    }
    const t0 = performance.now();
    (function tick(t) {
      const age = (t - t0) / 1900;
      ctx.clearRect(0, 0, c.width, c.height);
      if (age >= 1 || document.getElementById('levelfx').hidden) return;
      for (const p of ps) {
        p.x += p.vx; p.y += p.vy; p.vy += 0.12; p.vx *= 0.985;
        ctx.globalAlpha = Math.max(0, 1 - age);
        ctx.fillStyle = p.c;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill();
      }
      ctx.globalAlpha = 1;
      requestAnimationFrame(tick);
    })(t0);
  }
  function levelUp(level, title, onDone) {
    const fx = document.getElementById('levelfx');
    document.getElementById('lfNum').textContent = level;
    document.getElementById('lfTitle').textContent = title;
    fx.hidden = false;
    mount(document.getElementById('lfAvatar'), 240);
    celebrate();
    particleBurst();
    lfDone = onDone || null;
    document.getElementById('lfBtn').focus();
  }
  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('lfBtn').addEventListener('click', () => {
      document.getElementById('levelfx').hidden = true;
      if (lfDone) { const f = lfDone; lfDone = null; f(); }
    });
  });

  return { mount, celebrate, levelUp, buildCharacter, get ready() { build(); return !!renderer; } };
})();
