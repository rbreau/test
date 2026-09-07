'use strict';
/* ================================================================
   NUMERA — the living isle (Three.js)
   A Pokémon-Go-style home view: your Mathfinder wanders a low-poly
   island; each art of the isle is a floating sigil-crystal you can
   tap to face its trials. Degrades to the list view when WebGL or
   Three.js is unavailable (game.js checks NumeraIsle.ready).
   ================================================================ */
window.NumeraIsle = (function () {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const H = 460; // scene height in px
  let renderer = null, scene, camera, running = false;
  let rig = null, crystals = [], labels = [], container = null, labelWrap = null;
  let onSkillCb = null, isleSeed = 0;
  let walk = { target: null, pauseUntil: 0 };
  let ray = null, ptr = null;

  const STATE_COLOR = { 0: 0xf2c14e, 1: 0x8b7cf6, 2: 0x45d6b5, 3: 0xfff3cf };

  function ensureRenderer() {
    if (renderer || !window.THREE) return;
    try { renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true }); }
    catch (e) { renderer = null; return; }
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    ray = new THREE.Raycaster(); ptr = new THREE.Vector2();
    renderer.domElement.addEventListener('pointerdown', onPointer);
    addEventListener('resize', resize);
  }

  function rnd() { isleSeed = isleSeed * 16807 % 2147483647; return (isleSeed - 1) / 2147483646; }

  function buildScene(isle, isleIndex, skills) {
    isleSeed = isleIndex * 2711 + 13;
    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x0a0e23, 0.028);
    camera = new THREE.PerspectiveCamera(46, 16 / 9, 0.1, 100);
    camera.position.set(0, 4, 6.5);
    camera.lookAt(0, 0.6, 0);

    scene.add(new THREE.AmbientLight(0x8b9ff2, 0.6));
    const moon = new THREE.DirectionalLight(0xcfd8f2, 0.55);
    moon.position.set(4, 7, 3);
    scene.add(moon);

    const hue = new THREE.Color(isle.hue);
    const ground = hue.clone().lerp(new THREE.Color(0x1b2450), 0.55);
    const groundDark = hue.clone().lerp(new THREE.Color(0x0d1230), 0.75);

    // sea
    const sea = new THREE.Mesh(new THREE.CircleGeometry(30, 40), new THREE.MeshBasicMaterial({ color: 0x0c1636 }));
    sea.rotation.x = -Math.PI / 2; sea.position.y = -0.34;
    scene.add(sea);
    for (let i = 0; i < 3; i++) {
      const ring = new THREE.Mesh(new THREE.RingGeometry(3.9 + i * 1.15, 3.98 + i * 1.15, 48),
        new THREE.MeshBasicMaterial({ color: 0x45d6b5, transparent: true, opacity: 0.16 - i * 0.045, side: THREE.DoubleSide }));
      ring.rotation.x = -Math.PI / 2; ring.position.y = -0.32;
      scene.add(ring);
    }

    // the isle itself
    const base = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.9, 0.6, 12),
      new THREE.MeshStandardMaterial({ color: ground, flatShading: true, roughness: 0.95 }));
    base.position.y = -0.3;
    scene.add(base);
    const under = new THREE.Mesh(new THREE.CylinderGeometry(3.9, 2.6, 0.9, 12),
      new THREE.MeshStandardMaterial({ color: groundDark, flatShading: true, roughness: 1 }));
    under.position.y = -1.05;
    scene.add(under);

    // hills + standing stones + trees, seeded per isle
    const hillMat = new THREE.MeshStandardMaterial({ color: ground.clone().lerp(new THREE.Color(0x000000), 0.15), flatShading: true, roughness: 0.95 });
    const leafMat = new THREE.MeshStandardMaterial({ color: hue.clone().lerp(new THREE.Color(0x24406b), 0.45), flatShading: true, roughness: 0.9 });
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x33280f, flatShading: true, roughness: 1 });
    for (let i = 0; i < 4; i++) {
      const a = rnd() * Math.PI * 2, r = 2.8 + rnd() * 0.5;
      const hill = new THREE.Mesh(new THREE.ConeGeometry(0.45 + rnd() * 0.4, 0.5 + rnd() * 0.7, 6), hillMat);
      hill.position.set(Math.cos(a) * r, 0.15, Math.sin(a) * r);
      scene.add(hill);
    }
    for (let i = 0; i < 5; i++) {
      // outer ring only — the center stage belongs to the wanderer
      const a = rnd() * Math.PI * 2, r = 2.7 + rnd() * 0.5;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.4, 5), trunkMat);
      trunk.position.set(x, 0.2, z);
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.26 + rnd() * 0.15, 0.7 + rnd() * 0.4, 6), leafMat);
      leaf.position.set(x, 0.85, z);
      scene.add(trunk, leaf);
    }

    // sigil-crystals — one per art, arranged around the isle
    crystals = [];
    const n = skills.length;
    skills.forEach((sk, i) => {
      const a = (i / n) * Math.PI * 2 - Math.PI / 2;
      const pos = new THREE.Vector3(Math.cos(a) * 2.35, 1.15, Math.sin(a) * 2.35);
      const color = STATE_COLOR[Math.min(3, sk.crowns)];
      const grp = new THREE.Group();
      const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.26),
        new THREE.MeshStandardMaterial({ color, flatShading: true, emissive: color, emissiveIntensity: 0.45, roughness: 0.3 }));
      const cage = new THREE.Mesh(new THREE.OctahedronGeometry(0.4),
        new THREE.MeshBasicMaterial({ color, wireframe: true, transparent: true, opacity: 0.4 }));
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.06, 1.1, 6),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.3 }));
      beam.position.y = -0.6;
      grp.add(core, cage, beam);
      grp.position.copy(pos);
      grp.userData = { id: sk.id, i };
      scene.add(grp);
      crystals.push(grp);
    });

    // the wandering Mathfinder
    rig = NumeraAvatar.buildCharacter({ stars: false, lightIntensity: 0.9 });
    rig.g.scale.setScalar(0.78);
    rig.g.position.set(0, 0, 0.8);
    scene.add(rig.g);
    walk = { target: null, pauseUntil: 0 };
  }

  function pickTarget() {
    for (let tries = 0; tries < 8; tries++) {
      const a = Math.random() * Math.PI * 2, r = Math.random() * 2.1;
      const p = new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r);
      if (p.distanceTo(rig.g.position) > 1.3) return p;
    }
    return new THREE.Vector3(0, 0, 0);
  }

  function frame(t) {
    const s = t / 1000;
    // crystals float and slowly turn
    crystals.forEach((c, i) => {
      c.position.y = 1.15 + Math.sin(s * 1.3 + i * 1.7) * 0.08;
      c.children[0].rotation.y = s * 0.7 + i;
      c.children[1].rotation.y = -s * 0.4 + i;
    });
    // wander
    if (rig) {
      NumeraAvatar.idleRig(rig, s);
      rig.light.intensity = 0.9 + Math.sin(s * 3) * 0.12;
      if (!reduced) {
        if (walk.target) {
          const d = walk.target.clone().sub(rig.g.position); d.y = 0;
          const dist = d.length();
          if (dist < 0.08) { walk.target = null; walk.pauseUntil = t + 1200 + Math.random() * 2600; }
          else {
            const step = Math.min(dist, 0.0125);
            rig.g.position.add(d.normalize().multiplyScalar(step));
            const want = Math.atan2(d.x, d.z);
            let diff = want - rig.g.rotation.y;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            rig.g.rotation.y += diff * 0.08;
            rig.g.position.y = Math.abs(Math.sin(s * 7)) * 0.035; // little steps
          }
        } else if (t > walk.pauseUntil) {
          walk.target = pickTarget();
        } else {
          rig.g.position.y = Math.sin(s * 1.4) * 0.02;
        }
        // camera drifts after the wanderer
        const want = new THREE.Vector3(rig.g.position.x * 0.55, 3.1, rig.g.position.z * 0.4 + 5.9);
        camera.position.lerp(want, 0.02);
        camera.lookAt(rig.g.position.x * 0.5, 0.55, rig.g.position.z * 0.3);
      }
    }
    renderer.render(scene, camera);
    placeLabels();
  }

  function placeLabels() {
    if (!labelWrap) return;
    const w = renderer.domElement.clientWidth, h = renderer.domElement.clientHeight;
    crystals.forEach((c, i) => {
      const el = labels[i];
      if (!el) return;
      const v = c.position.clone(); v.y += 0.62;
      v.project(camera);
      el.style.left = ((v.x * 0.5 + 0.5) * w) + 'px';
      el.style.top = ((-v.y * 0.5 + 0.5) * h) + 'px';
    });
  }

  function loop(t) {
    if (!running) return;
    if (!document.hidden) frame(t);
    requestAnimationFrame(loop);
  }

  function onPointer(e) {
    const r = renderer.domElement.getBoundingClientRect();
    ptr.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    ptr.y = -((e.clientY - r.top) / r.height) * 2 + 1;
    ray.setFromCamera(ptr, camera);
    const hits = ray.intersectObjects(crystals, true);
    if (hits.length && onSkillCb) {
      let o = hits[0].object;
      while (o && !o.userData.id) o = o.parent;
      if (o) onSkillCb(o.userData.id);
    }
  }

  function resize() {
    if (!renderer || !container || !container.isConnected) return;
    const w = container.clientWidth || 800;
    renderer.setSize(w, H);
    camera.aspect = w / H;
    camera.updateProjectionMatrix();
  }

  /* mount(container, labelWrap, isle, isleIndex, skills, onSkill)
     skills: [{id, name, crowns}]; returns false when 3D is unavailable */
  function mount(cont, lw, isle, isleIndex, skills, onSkill) {
    ensureRenderer();
    if (!renderer) return false;
    container = cont; labelWrap = lw; onSkillCb = onSkill;
    buildScene(isle, isleIndex, skills);
    cont.innerHTML = '';
    cont.appendChild(renderer.domElement);
    lw.innerHTML = '';
    labels = skills.map(sk => {
      const el = document.createElement('button');
      el.className = 'isleLabel';
      el.innerHTML = `${sk.name}<i>${'♛'.repeat(sk.crowns) || '·'}</i>`;
      el.addEventListener('click', () => onSkill(sk.id));
      lw.appendChild(el);
      return el;
    });
    resize();
    if (reduced) { frame(1500); return true; }
    if (!running) { running = true; requestAnimationFrame(loop); }
    return true;
  }
  function stop() { running = false; }
  function resume() {
    if (!renderer || !container || !container.isConnected) return;
    resize(); // the home screen may have been hidden (zero-width) at mount time
    if (reduced) { frame(1500); return; }
    if (!running) { running = true; requestAnimationFrame(loop); }
  }

  return { mount, stop, resume, get ready() { ensureRenderer(); return !!renderer; } };
})();
