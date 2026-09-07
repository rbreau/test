'use strict';
/* ================================================================
   NUMERA — the Mathfinder avatar (Three.js) + level-up ceremony
   A procedural low-poly lantern-bearer: hooded robe, golden eyes,
   an octahedron lantern, and a slow orbit of stars. Degrades
   gracefully to nothing if WebGL or Three.js is unavailable.
   ================================================================ */
window.NumeraAvatar = (function () {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let renderer = null, scene, camera, rig = null, running = false;
  let celebrateT = 0;

  function build() {
    if (renderer || !window.THREE) return;
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    } catch (e) { renderer = null; return; }
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(35, 1, 0.1, 50);
    camera.position.set(0, 1.2, 3.6);
    camera.lookAt(0, 0.95, 0);

    scene.add(new THREE.AmbientLight(0x8b9ff2, 0.65));
    const key = new THREE.DirectionalLight(0xf2e6c8, 0.55);
    key.position.set(2, 4, 3);
    scene.add(key);

    const robeMat = new THREE.MeshStandardMaterial({ color: 0x2a3a7a, flatShading: true, roughness: 0.85 });
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xf2c14e, flatShading: true, roughness: 0.4, metalness: 0.35, emissive: 0x6b4f0e });
    const glowMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });

    const g = new THREE.Group();

    const robe = new THREE.Mesh(new THREE.ConeGeometry(0.52, 1.2, 9), robeMat);
    robe.position.y = 0.6; g.add(robe);
    const trim = new THREE.Mesh(new THREE.TorusGeometry(0.44, 0.035, 8, 24), goldMat);
    trim.rotation.x = Math.PI / 2; trim.position.y = 0.09; g.add(trim);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 14, 10), new THREE.MeshStandardMaterial({ color: 0x141b3d, flatShading: true, roughness: 0.9 }));
    head.position.y = 1.34; g.add(head);
    const hood = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.52, 9), robeMat);
    hood.position.y = 1.52; g.add(hood);
    const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.055, 8, 20), goldMat);
    scarf.rotation.x = Math.PI / 2; scarf.position.y = 1.12; g.add(scarf);

    const eyes = new THREE.Group();
    [-0.09, 0.09].forEach(x => {
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.036, 8, 8), glowMat);
      e.position.set(x, 1.35, 0.21); eyes.add(e);
    });
    g.add(eyes);

    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.5, 7), robeMat);
    arm.position.set(0.4, 1.02, 0.14); arm.rotation.z = -1.0; arm.rotation.x = -0.25;
    g.add(arm);

    const lantern = new THREE.Group();
    const cage = new THREE.Mesh(new THREE.OctahedronGeometry(0.14), new THREE.MeshBasicMaterial({ color: 0xf2c14e, wireframe: true }));
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 10), glowMat);
    const light = new THREE.PointLight(0xf2c14e, 1.2, 5);
    lantern.add(cage, core, light);
    lantern.position.set(0.68, 0.82, 0.22);
    g.add(lantern);

    const starGeo = new THREE.BufferGeometry();
    const pos = new Float32Array(42 * 3);
    for (let i = 0; i < 42; i++) {
      const a = Math.random() * Math.PI * 2, r = 0.9 + Math.random() * 0.9, y = 0.2 + Math.random() * 1.7;
      pos[i * 3] = Math.cos(a) * r; pos[i * 3 + 1] = y; pos[i * 3 + 2] = Math.sin(a) * r;
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xede6d3, size: 0.035, transparent: true, opacity: 0.85 }));
    g.add(stars);

    scene.add(g);
    rig = { g, lantern, light, stars, eyes, baseY: 0 };
  }

  function frame(t) {
    if (!rig) return;
    const s = t / 1000;
    let spin = Math.sin(s * 0.5) * 0.3, y = Math.sin(s * 1.4) * 0.05, flare = 1.1 + Math.sin(s * 3) * 0.15, sScale = 1;
    if (celebrateT) {
      const p = (t - celebrateT) / 2400;
      if (p >= 1) celebrateT = 0;
      else {
        const e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2; // easeInOutQuad
        spin += e * Math.PI * 4;
        y += Math.sin(p * Math.PI) * 0.55;
        flare = 1.2 + Math.sin(p * Math.PI) * 2.2;
        sScale = 1 + Math.sin(p * Math.PI) * 0.6;
      }
    }
    rig.g.rotation.y = spin;
    rig.g.position.y = y;
    rig.lantern.rotation.z = Math.sin(s * 1.8) * 0.14;
    rig.light.intensity = flare;
    rig.stars.rotation.y = s * 0.12;
    rig.stars.scale.setScalar(sScale);
    const blink = (s % 3.7) > 3.55 ? 0.15 : 1; // periodic blink
    rig.eyes.scale.y = blink;
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
    if (reduced) { frame(1200); return; } // a single still frame
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
      ps.push({ x: cx, y: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 2, r: 1.5 + Math.random() * 3.5, c: colors[i % colors.length], life: 1 });
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
    mount(document.getElementById('lfAvatar'), 220);
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

  return { mount, celebrate, levelUp, get ready() { build(); return !!renderer; } };
})();
