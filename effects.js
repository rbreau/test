'use strict';
/* ================================================================
   NUMERA — living-world effects
   Footstep dust, beacon sparkles, Numen companions orbiting the
   player, butterflies over the flowers, a flock of birds by day,
   shooting stars by night. All cheap: pooled points and a handful
   of tiny meshes. Created per island by island3d.js.
   ================================================================ */
window.NumeraFX = (function () {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* A pool of soft particles with per-particle life, drawn as one Points object. */
  class PointPool {
    constructor(scene, n, color, size, opts) {
      opts = opts || {};
      this.n = n; this.p = []; for (let i = 0; i < n; i++) this.p.push({ a: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0, span: 1, g: opts.gravity || 0 });
      this.pos = new Float32Array(n * 3); this.life = new Float32Array(n).fill(2);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
      geo.setAttribute('aLife', new THREE.BufferAttribute(this.life, 1));
      this.mat = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, blending: opts.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
        uniforms: { uColor: { value: new THREE.Color(color) }, uSize: { value: size }, uGrow: { value: opts.grow === undefined ? 1.6 : opts.grow } },
        vertexShader: `attribute float aLife; uniform float uSize; uniform float uGrow; varying float vA;
          void main(){ vA = aLife > 1.0 ? 0.0 : (1.0 - aLife) * smoothstep(0.0, 0.08, aLife);
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            gl_PointSize = uSize * (1.0 + aLife * uGrow) * (34.0 / max(-mv.z, 1.0)); gl_Position = projectionMatrix * mv; }`,
        fragmentShader: `uniform vec3 uColor; varying float vA;
          void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.12, d) * vA; if (a < 0.01) discard; gl_FragColor = vec4(uColor, a); }`,
      });
      this.points = new THREE.Points(geo, this.mat); this.points.frustumCulled = false; scene.add(this.points);
    }
    spawn(x, y, z, vx, vy, vz, span) {
      const q = this.p.find(o => !o.a) || this.p[0];
      Object.assign(q, { a: true, x, y, z, vx, vy, vz, life: 0, span: span || 1 });
    }
    update(dt) {
      for (let i = 0; i < this.n; i++) {
        const q = this.p[i];
        if (q.a) { q.life += dt / q.span; if (q.life >= 1) q.a = false; else { q.vy -= q.g * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt; } }
        this.pos[i * 3] = q.x; this.pos[i * 3 + 1] = q.y; this.pos[i * 3 + 2] = q.z; this.life[i] = q.a ? q.life : 2;
      }
      this.points.geometry.attributes.position.needsUpdate = true; this.points.geometry.attributes.aLife.needsUpdate = true;
    }
  }

  function create(scene, cfg) {
    const hue = cfg.hue, beacons = cfg.beacons || [], isleR = cfg.isleR || 9;
    const fx = {};

    // ---- footstep dust (spawned by island3d on each stride)
    const puffs = new PointPool(scene, 48, 0xf1ead6, 9, { grow: 2.2 });
    fx.step = (pos, heading) => { for (let i = 0; i < 3; i++) puffs.spawn(pos.x + (Math.random() - 0.5) * 0.25, 0.05, pos.z + (Math.random() - 0.5) * 0.25, (Math.random() - 0.5) * 0.5 - Math.sin(heading) * 0.3, 0.35 + Math.random() * 0.25, (Math.random() - 0.5) * 0.5 - Math.cos(heading) * 0.3, 0.6 + Math.random() * 0.3); };

    // ---- beacon sparkles: motes rising from each disc toward its gem
    const sparkles = beacons.map(b => ({ b, pool: new PointPool(scene, 22, b.userData.gem.material.color.getHex(), 5, { additive: true, grow: 0.3 }), acc: 0 }));

    // ---- companions: caught Numen orbit the player as glowing orbs
    const orbGroup = new THREE.Group(); scene.add(orbGroup); let orbs = [];
    fx.setCompanions = (count, stars) => {
      orbs.forEach(o => orbGroup.remove(o.m)); orbs = [];
      const n = Math.min(6, count);
      for (let i = 0; i < n; i++) {
        const star = i < stars;
        const m = new THREE.Mesh(new THREE.SphereGeometry(star ? 0.085 : 0.065, 12, 10), new THREE.MeshBasicMaterial({ color: star ? 0xf2c14e : 0x45d6b5 }));
        const halo = new THREE.Mesh(new THREE.SphereGeometry(star ? 0.16 : 0.12, 12, 10), new THREE.MeshBasicMaterial({ color: star ? 0xf2c14e : 0x45d6b5, transparent: true, opacity: 0.22, depthWrite: false }));
        m.add(halo); orbGroup.add(m);
        orbs.push({ m, phase: i / n * Math.PI * 2, r: 0.55 + (i % 3) * 0.18, h: 1.25 + (i % 2) * 0.25, w: 0.9 + (i % 3) * 0.2 });
      }
    };

    // ---- butterflies over the meadow
    const flies = [];
    const nFly = reduced ? 0 : 7;
    for (let i = 0; i < nFly; i++) {
      const g = new THREE.Group();
      const col = [0xf2c14e, 0xf26b8a, 0x8b7cf6, 0x45d6b5, 0xffffff][i % 5];
      const wm = new THREE.MeshBasicMaterial({ color: col, side: THREE.DoubleSide });
      const wl = new THREE.Mesh(new THREE.PlaneGeometry(0.11, 0.09), wm), wr = wl.clone();
      wl.position.x = -0.055; wr.position.x = 0.055; g.add(wl, wr);
      const a = Math.random() * Math.PI * 2, r = 2.4 + Math.random() * 2.2;
      g.userData = { cx: Math.cos(a) * r, cz: Math.sin(a) * r, ph: Math.random() * 10, w: 0.5 + Math.random() * 0.4, wl, wr };
      scene.add(g); flies.push(g);
    }

    // ---- birds: a small flock circling high, daytime only
    const birds = [];
    const nBird = reduced ? 0 : 5;
    const birdMat = new THREE.MeshBasicMaterial({ color: 0x2a3050, transparent: true, opacity: 0.8 });
    for (let i = 0; i < nBird; i++) {
      const g = new THREE.Group();
      const l = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.03, 0.1), birdMat), r = l.clone();
      l.position.x = -0.2; r.position.x = 0.2; g.add(l, r);
      g.userData = { ph: i * 1.3, l, r, rad: 13 + i * 1.1, h: 9.5 + i * 0.6 };
      scene.add(g); birds.push(g);
    }

    // ---- shooting stars at night
    const streaks = [];
    for (let i = 0; i < 2; i++) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 4.5), new THREE.MeshBasicMaterial({ color: 0xfff6dc, transparent: true, opacity: 0, fog: false }));
      m.visible = false; scene.add(m); streaks.push({ m, t: -1, from: new THREE.Vector3(), to: new THREE.Vector3() });
    }
    let nextStreak = 4 + Math.random() * 8;

    fx.update = ctx => {
      const { t, dt, player, L } = ctx;
      puffs.update(dt);
      sparkles.forEach(s => { s.acc += dt * 5; while (s.acc >= 1) { s.acc -= 1; const a = Math.random() * Math.PI * 2, r = Math.random() * 0.4; s.pool.spawn(s.b.position.x + Math.cos(a) * r, 0.2, s.b.position.z + Math.sin(a) * r, 0, 0.7 + Math.random() * 0.5, 0, 1.6 + Math.random() * 0.8); } s.pool.update(dt); });
      orbs.forEach(o => {
        const want = new THREE.Vector3(player.x + Math.cos(t * o.w + o.phase) * o.r, o.h + Math.sin(t * 1.7 + o.phase) * 0.12, player.z + Math.sin(t * o.w + o.phase) * o.r);
        o.m.position.lerp(want, 0.08);
      });
      flies.forEach(g => {
        const u = g.userData, tt = t * u.w + u.ph;
        g.position.set(u.cx + Math.sin(tt) * 0.9, 0.45 + Math.sin(tt * 2.3) * 0.25 + 0.2, u.cz + Math.sin(tt * 2) * 0.45);
        g.rotation.y = Math.atan2(Math.cos(tt) * 0.9, Math.cos(tt * 2) * 0.9);
        const flap = Math.sin(t * 22 + u.ph) * 0.9; u.wl.rotation.y = flap; u.wr.rotation.y = -flap;
        g.visible = L.day > 0.15;
      });
      birdMat.opacity = 0.8 * L.day;
      birds.forEach(g => {
        const u = g.userData, a = t * 0.16 + u.ph;
        g.position.set(Math.cos(a) * u.rad, u.h + Math.sin(t * 0.7 + u.ph) * 0.5, -6 + Math.sin(a) * u.rad * 0.6);
        g.rotation.y = -a + Math.PI / 2;
        const flap = Math.sin(t * 6 + u.ph) * 0.6; u.l.rotation.z = flap; u.r.rotation.z = -flap;
        g.visible = L.day > 0.05;
      });
      if (L.night > 0.5 && !reduced) {
        nextStreak -= dt;
        if (nextStreak <= 0) {
          nextStreak = 5 + Math.random() * 10;
          const s = streaks.find(x => x.t < 0); if (s) { const a = Math.random() * Math.PI * 2; s.from.set(Math.cos(a) * 60, 40 + Math.random() * 20, Math.sin(a) * 60 - 30); s.to.copy(s.from).add(new THREE.Vector3(-25 - Math.random() * 15, -14, 6)); s.t = 0; s.m.visible = true; s.m.lookAt(s.to); }
        }
      }
      streaks.forEach(s => { if (s.t < 0) return; s.t += dt / 1.1; if (s.t >= 1) { s.t = -1; s.m.visible = false; return; } s.m.position.lerpVectors(s.from, s.to, s.t); s.m.lookAt(s.to); s.m.material.opacity = Math.sin(s.t * Math.PI) * 0.9; });
    };
    return fx;
  }
  return { create };
})();
