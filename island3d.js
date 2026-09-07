'use strict';
/* ================================================================
   NUMERA — the living isle (Three.js)
   The home view: a bright, soft-shaded island under a cloud-strewn
   sky. Your Mathfinder walks its ring-road while the camera follows
   low behind them; each art of the isle is a beacon you can tap.
   Shadow maps, ACES tone mapping, sRGB output, distance fog.
   Falls back to the list view when WebGL is unavailable.
   ================================================================ */
window.NumeraIsle = (function () {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const mobile = /Mobi|Android/i.test(navigator.userAgent) || innerWidth < 700;
  let renderer = null, scene, camera, running = false;
  let rig = null, beacons = [], labels = [], container = null, labelWrap = null;
  let onSkillCb = null, isleSeed = 0, clouds = [], sun = null;
  let walk = { target: null, pauseUntil: 0, speed: 0 };
  let ray = null, ptr = null;
  const STATE_COLOR = { 0: 0xf2c14e, 1: 0x8b7cf6, 2: 0x45d6b5, 3: 0xffffff };
  const ISLE_R = 9;

  function ensureRenderer() {
    if (renderer || !window.THREE) return;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' }); }
    catch (e) { renderer = null; return; }
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, mobile ? 1.75 : 2));
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.95;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    ray = new THREE.Raycaster(); ptr = new THREE.Vector2();
    renderer.domElement.addEventListener('pointerdown', onPointer);
    addEventListener('resize', resize);
  }
  function rnd() { isleSeed = isleSeed * 16807 % 2147483647; return (isleSeed - 1) / 2147483646; }
  const std = (color, extra) => new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.9, metalness: 0 }, extra || {}));
  function put(geo, m, x, y, z, shadow) {
    const o = new THREE.Mesh(geo, m); o.position.set(x, y, z);
    if (shadow !== false) { o.castShadow = true; o.receiveShadow = true; }
    scene.add(o); return o;
  }

  /* ---------- procedural textures ---------- */
  function grassTexture(hue) {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const x = c.getContext('2d');
    const base = new THREE.Color(hue).lerp(new THREE.Color(0x7fcf9f), 0.72);
    x.fillStyle = '#' + base.getHexString(); x.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 1400; i++) {
      const shade = base.clone().offsetHSL(0, 0, (Math.random() - 0.5) * 0.1);
      x.fillStyle = '#' + shade.getHexString();
      x.fillRect(Math.random() * 256, Math.random() * 256, 2 + Math.random() * 4, 2 + Math.random() * 3);
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(9, 9); t.encoding = THREE.sRGBEncoding;
    return t;
  }
  function skyDome() {
    const geo = new THREE.SphereGeometry(140, 32, 16);
    const m = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false,
      uniforms: { top: { value: new THREE.Color(0x4f9be8) }, mid: { value: new THREE.Color(0xa9d6f5) }, bot: { value: new THREE.Color(0xe6f1f7) } },
      vertexShader: 'varying float h; void main(){ h = normalize(position).y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 top; uniform vec3 mid; uniform vec3 bot; varying float h; void main(){ float t = clamp(h, -0.05, 1.0); vec3 c = t < 0.25 ? mix(bot, mid, t/0.25) : mix(mid, top, (t-0.25)/0.75); gl_FragColor = vec4(c, 1.0); }',
    });
    return new THREE.Mesh(geo, m);
  }
  function cloud(x, y, z, s) {
    const g = new THREE.Group();
    const m = std(0xffffff, { roughness: 1, emissive: 0xffffff, emissiveIntensity: 0.25 });
    const n = 3 + Math.floor(rnd() * 3);
    for (let i = 0; i < n; i++) {
      const r = (0.8 + rnd() * 0.9) * s;
      const o = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), m);
      o.position.set((i - n / 2) * 1.1 * s + rnd() * 0.4, rnd() * 0.4 * s, (rnd() - 0.5) * 0.8 * s);
      o.scale.y = 0.62;
      g.add(o);
    }
    g.position.set(x, y, z);
    g.userData.speed = 0.15 + rnd() * 0.2;
    scene.add(g);
    return g;
  }

  /* ---------- scene ---------- */
  function buildScene(isle, isleIndex, skills) {
    isleSeed = isleIndex * 2711 + 13;
    beacons = []; clouds = [];
    scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0xcfe3f2, 34, 120);
    camera = new THREE.PerspectiveCamera(50, 16 / 9, 0.1, 300);
    camera.position.set(0, 3.7, 8.8);
    camera.lookAt(0, 1.1, 0);

    scene.add(skyDome());
    scene.add(new THREE.HemisphereLight(0xdff0ff, 0x6fa383, 0.55));
    sun = new THREE.DirectionalLight(0xfff3dd, 1.2);
    sun.position.set(8, 14, 6);
    sun.castShadow = true;
    sun.shadow.mapSize.set(mobile ? 1024 : 2048, mobile ? 1024 : 2048);
    sun.shadow.camera.left = sun.shadow.camera.bottom = -12;
    sun.shadow.camera.right = sun.shadow.camera.top = 12;
    sun.shadow.camera.near = 2; sun.shadow.camera.far = 40;
    sun.shadow.bias = -0.0006;
    scene.add(sun);

    // sea + far isles
    put(new THREE.CircleGeometry(160, 48), std(0x7ccfe4, { roughness: 0.35, metalness: 0.05 }), 0, -0.55, 0, false).rotation.x = -Math.PI / 2;
    for (let i = 0; i < 5; i++) {
      const a = rnd() * Math.PI * 2, d = 34 + rnd() * 22;
      const far = put(new THREE.SphereGeometry(4 + rnd() * 5, 16, 10), std(0x9fd3c0), Math.cos(a) * d, -1.2, Math.sin(a) * d, false);
      far.scale.y = 0.28 + rnd() * 0.12;
    }

    // the isle: grass plateau on a cliff
    const hue = new THREE.Color(isle.hue);
    const grass = std(0xffffff, { map: grassTexture(isle.hue), roughness: 1 });
    const top = put(new THREE.CylinderGeometry(ISLE_R, ISLE_R + 0.4, 0.5, 48), grass, 0, -0.25, 0);
    top.castShadow = false;
    put(new THREE.CylinderGeometry(ISLE_R + 0.4, ISLE_R - 1.5, 1.6, 48), std(hue.clone().lerp(new THREE.Color(0x6b5a4a), 0.7)), 0, -1.3, 0, false);

    // PoGo-style paths: grey with yellow edges — a ring road, spokes to each beacon, a central plaza
    const road = std(0x5b6474, { roughness: 0.95 }), edge = std(0xf4d36a, { roughness: 0.8 }), stone = std(0xe1e6ea);
    const ringR = 5.2, ringW = 0.7;
    const flat = (geo, m, y) => { const o = put(geo, m, 0, y, 0); o.rotation.x = -Math.PI / 2; o.castShadow = false; return o; };
    flat(new THREE.RingGeometry(ringR - ringW / 2, ringR + ringW / 2, 96), road, 0.012);
    flat(new THREE.RingGeometry(ringR - ringW / 2 - 0.09, ringR - ringW / 2, 96), edge, 0.014);
    flat(new THREE.RingGeometry(ringR + ringW / 2, ringR + ringW / 2 + 0.09, 96), edge, 0.014);
    flat(new THREE.CircleGeometry(1.5, 40), stone, 0.012);
    flat(new THREE.RingGeometry(1.5, 1.62, 40), edge, 0.014);
    const n = skills.length;
    skills.forEach((sk, i) => {
      const a = (i / n) * Math.PI * 2 + Math.PI / n;
      const dir = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
      const len = ringR - 1.5 + 0.35, mid = 1.5 + len / 2;
      const spoke = flat(new THREE.PlaneGeometry(0.62, len), road, 0.011);
      spoke.position.set(dir.x * mid, 0.011, dir.z * mid); spoke.rotation.z = -a + Math.PI / 2;
      [-1, 1].forEach(s => {
        const e = flat(new THREE.PlaneGeometry(0.08, len), edge, 0.013);
        const off = new THREE.Vector3(-dir.z, 0, dir.x).multiplyScalar(s * 0.35);
        e.position.set(dir.x * mid + off.x, 0.013, dir.z * mid + off.z); e.rotation.z = -a + Math.PI / 2;
      });
      // beacon plaza + pillar
      const bp = dir.clone().multiplyScalar(ringR + 1.4);
      flat(new THREE.CircleGeometry(0.95, 32), stone, 0.012).position.set(bp.x, 0.012, bp.z);
      const color = STATE_COLOR[Math.min(3, sk.crowns)];
      const grp = new THREE.Group(); grp.position.copy(bp);
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 2.4, 16), std(0xbfe9ff, { transparent: true, opacity: 0.55, roughness: 0.2 }));
      pillar.position.y = 1.2; grp.add(pillar);
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.62, 0.12, 24), std(color, { emissive: color, emissiveIntensity: 0.25 }));
      disc.position.y = 0.06; disc.castShadow = true; grp.add(disc);
      const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.42), std(color, { emissive: color, emissiveIntensity: 0.55, roughness: 0.25 }));
      gem.position.y = 2.95; gem.castShadow = true; grp.add(gem);
      const halo = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.03, 8, 40), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.7 }));
      halo.position.y = 2.95; halo.rotation.x = Math.PI / 2; grp.add(halo);
      grp.userData = { id: sk.id, i, gem, halo };
      scene.add(grp);
      beacons.push(grp);
    });

    // translucent teal blocks — the sleeping town, PoGo-style
    const block = new THREE.MeshPhysicalMaterial({ color: 0x8fe6d6, transparent: true, opacity: 0.55, roughness: 0.25, transmission: 0, metalness: 0 });
    for (let i = 0; i < 16; i++) {
      const a = rnd() * Math.PI * 2, r = 6.9 + rnd() * 1.6;
      const w = 0.5 + rnd() * 0.9, h = 0.3 + rnd() * 1.1, d = 0.5 + rnd() * 0.9;
      const b = put(new THREE.BoxGeometry(w, h, d), block, Math.cos(a) * r, h / 2, Math.sin(a) * r);
      b.rotation.y = rnd() * Math.PI;
    }
    // trees between the spokes
    const leaf = std(hue.clone().lerp(new THREE.Color(0x2f9a5c), 0.75)), trunk = std(0x6b4b2e);
    for (let i = 0; i < 7; i++) {
      const a = rnd() * Math.PI * 2, r = 2.6 + rnd() * 1.7;
      const x = Math.cos(a) * r, z = Math.sin(a) * r, h = 0.7 + rnd() * 0.4;
      put(new THREE.CylinderGeometry(0.05, 0.08, h, 8), trunk, x, h / 2, z);
      const can = put(new THREE.SphereGeometry(0.3 + rnd() * 0.18, 14, 12), leaf, x, h + 0.22, z);
      can.scale.y = 1.2;
    }
    for (let i = 0; i < 9; i++) clouds.push(cloud((rnd() - 0.5) * 60, 11 + rnd() * 6, -14 - rnd() * 30, 1.2 + rnd() * 1.2));

    // the Mathfinder
    rig = NumeraAvatar.buildCharacter({ lightIntensity: 0.6 });
    rig.g.position.set(0, 0, 2.2);
    rig.g.rotation.y = Math.PI;
    scene.add(rig.g);
    walk = { target: null, pauseUntil: performance.now() + 900, speed: 0 };
  }

  function pickTarget() {
    for (let tries = 0; tries < 10; tries++) {
      const a = Math.random() * Math.PI * 2, r = 1 + Math.random() * 5.6;
      const p = new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r);
      if (p.distanceTo(rig.g.position) > 2.2) return p;
    }
    return new THREE.Vector3(0, 0, 0);
  }

  function frame(t) {
    const s = t / 1000;
    beacons.forEach((b, i) => {
      b.userData.gem.rotation.y = s * 0.8 + i;
      b.userData.gem.position.y = 2.95 + Math.sin(s * 1.4 + i) * 0.1;
      b.userData.halo.rotation.z = s * 0.5;
      b.userData.halo.scale.setScalar(1 + Math.sin(s * 2 + i) * 0.06);
    });
    clouds.forEach(c => { c.position.x += c.userData.speed * 0.016; if (c.position.x > 40) c.position.x = -40; });
    if (rig) {
      if (!reduced) {
        if (walk.target) {
          const d = walk.target.clone().sub(rig.g.position); d.y = 0;
          const dist = d.length();
          if (dist < 0.1) { walk.target = null; walk.pauseUntil = t + 1500 + Math.random() * 3000; }
          else {
            walk.speed = Math.min(1, walk.speed + 0.03);
            rig.g.position.add(d.normalize().multiplyScalar(0.022 * walk.speed));
            const want = Math.atan2(d.x, d.z);
            let diff = want - rig.g.rotation.y;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            rig.g.rotation.y += diff * 0.08;
          }
        } else {
          walk.speed = Math.max(0, walk.speed - 0.05);
          if (t > walk.pauseUntil) walk.target = pickTarget();
        }
        // low, behind-the-shoulder camera with a fixed compass heading (like PoGo)
        const p = rig.g.position;
        const back = camera.aspect < 1 ? 8.2 : 6.6, up = camera.aspect < 1 ? 4.4 : 3.7;
        const want = new THREE.Vector3(p.x, up, p.z + back);
        camera.position.lerp(want, 0.035);
        camera.lookAt(p.x, 1.1, p.z - 2.2);
        sun.position.set(p.x + 8, 14, p.z + 6); sun.target.position.copy(p); sun.target.updateMatrixWorld();
      }
      rig.animate(s, walk.speed);
    }
    renderer.render(scene, camera);
    placeLabels();
  }

  function placeLabels() {
    if (!labelWrap) return;
    const w = renderer.domElement.clientWidth, h = renderer.domElement.clientHeight;
    beacons.forEach((b, i) => {
      const el = labels[i]; if (!el) return;
      const v = b.position.clone(); v.y += 3.75;
      v.project(camera);
      const behind = v.z > 1;
      el.style.opacity = behind ? '0' : '1';
      el.style.left = ((v.x * 0.5 + 0.5) * w) + 'px';
      el.style.top = ((-v.y * 0.5 + 0.5) * h) + 'px';
    });
  }
  function loop(t) { if (!running) return; if (!document.hidden) frame(t); requestAnimationFrame(loop); }

  function onPointer(e) {
    const r = renderer.domElement.getBoundingClientRect();
    ptr.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    ptr.y = -((e.clientY - r.top) / r.height) * 2 + 1;
    ray.setFromCamera(ptr, camera);
    const hits = ray.intersectObjects(beacons, true);
    if (hits.length && onSkillCb) {
      let o = hits[0].object;
      while (o && !o.userData.id) o = o.parent;
      if (o) onSkillCb(o.userData.id);
    }
  }
  function resize() {
    if (!renderer || !container || !container.isConnected) return;
    const w = container.clientWidth || 800, h = container.clientHeight || 520;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  /* mount(container, labelWrap, isle, isleIndex, skills[{id,name,crowns}], onSkill) → false if no 3D */
  function mount(cont, lw, isle, isleIndex, skills, onSkill) {
    ensureRenderer();
    if (!renderer) return false;
    container = cont; labelWrap = lw; onSkillCb = onSkill;
    buildScene(isle, isleIndex, skills);
    cont.innerHTML = ''; cont.appendChild(renderer.domElement);
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
    resize();
    if (reduced) { frame(1500); return; }
    if (!running) { running = true; requestAnimationFrame(loop); }
  }
  return { mount, stop, resume, get ready() { ensureRenderer(); return !!renderer; } };
})();
