'use strict';
/* ================================================================
   NUMERA — the living isle (Three.js r128 + post-processing)
   Home view: your Mathfinder walks a stylized island under a live
   sky. Rendering: shadow maps, ACES tone mapping, sRGB output via a
   final grade pass, bloom, SSAO (desktop), FXAA or MSAA, distance
   fog. World: animated water shader, wind-swept instanced grass and
   flowers, pollen by day / fireflies by night, real-clock day-night
   cycle, twelve biomes with landmarks, beacons for each art.
   Falls back to the list view without WebGL.
   ================================================================ */
window.NumeraIsle = (function () {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const mobile = /Mobi|Android/i.test(navigator.userAgent) || innerWidth < 700;
  const ISLE_R = 9, RING_R = 5.2, BEACON_R = RING_R + 1.4;
  let renderer = null, composer = null, bloomPass = null, gradePass = null, ssaoPass = null;
  let scene, camera, running = false, rig = null, beacons = [], labels = [], container = null, labelWrap = null;
  let onSkillCb = null, isleSeed = 0, clouds = [], sun = null, hemi = null, sky = null, water = null, stars = null;
  let grassU = { value: 0 }, pollen = null, fireflies = null, nightLights = [], anims = [], curIsle = null, curSkills = [], curIsleIndex = 0;
  let walk = { target: null, pauseUntil: 0, speed: 0 };
  let ray = null, ptr = null, lastT = 0;
  let landmarkZone = null, tapMarker = null, markerT = -1, mountCount = 0, fx = null, companions = { count: 0, stars: 0 };
  const cam = { yaw: 0, pitch: 0.5, dist: 6.6, zoomed: false, punchT: -1 };
  const pointers = new Map(); let gesture = { type: 'none' }, strideAcc = 0, lastPlayerPos = null;
  const grassPlayer = { value: new THREE.Vector3(0, 0, 99) };
  const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const qs = new URLSearchParams(location.search), hourParam = qs.get('hour');
  const DBG = { nossao: qs.has('nossao'), nobloom: qs.has('nobloom'), nopost: qs.has('nopost') };
  const STATE_COLOR = { 0: 0xf2c14e, 1: 0x8b7cf6, 2: 0x45d6b5, 3: 0xffffff };

  /* ---------------- helpers ---------------- */
  function rnd() { isleSeed = isleSeed * 16807 % 2147483647; return (isleSeed - 1) / 2147483646; }
  const TOON = () => !window.NumeraAssets || NumeraAssets.toon();
  const std = (color, extra) => {
    extra = extra || {};
    if (TOON() && !extra.metalness) {
      const t = new THREE.MeshToonMaterial({ color, gradientMap: NumeraAssets.toonRamp() });
      ['map', 'emissiveIntensity', 'transparent', 'opacity', 'side', 'depthWrite'].forEach(k => { if (extra[k] !== undefined) t[k] = extra[k]; });
      if (extra.emissive !== undefined) t.emissive = new THREE.Color(extra.emissive);
      return t;
    }
    return new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.9, metalness: 0 }, extra));
  };
  function put(geo, m, x, y, z, shadow) {
    const o = new THREE.Mesh(geo, m); o.position.set(x, y, z);
    if (shadow !== false) { o.castShadow = true; o.receiveShadow = true; }
    scene.add(o); return o;
  }
  const flat = (geo, m, x, y, z) => { const o = put(geo, m, x, y, z); o.rotation.x = -Math.PI / 2; o.castShadow = false; return o; };
  const lerpC = (a, b, t) => new THREE.Color(a).lerp(new THREE.Color(b), t);

  /* ---------------- renderer + post chain ---------------- */
  function ensureRenderer() {
    if (renderer || !window.THREE) return;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' }); }
    catch (e) { renderer = null; return; }
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, mobile ? 1.5 : 2));
    renderer.outputEncoding = THREE.LinearEncoding; // the grade pass converts to sRGB
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.95;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    ray = new THREE.Raycaster(); ptr = new THREE.Vector2();
    renderer.domElement.style.touchAction = 'none';
    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('pointerup', onPointerUp);
    renderer.domElement.addEventListener('pointercancel', onPointerUp);
    renderer.domElement.addEventListener('wheel', onWheel, { passive: false });
    addEventListener('resize', resize);
  }
  function buildComposer(w, h) {
    const hasPost = !!(THREE.EffectComposer && THREE.RenderPass && THREE.ShaderPass);
    if (composer) { try { composer.renderTarget1.dispose(); composer.renderTarget2.dispose(); composer.passes.forEach(p => p.dispose && p.dispose()); } catch (e) { } composer = null; bloomPass = null; ssaoPass = null; }
    if (!hasPost || DBG.nopost) { composer = null; renderer.outputEncoding = THREE.sRGBEncoding; return; }
    renderer.outputEncoding = THREE.LinearEncoding;
    let target;
    if (renderer.capabilities.isWebGL2 && THREE.WebGLMultisampleRenderTarget) {
      target = new THREE.WebGLMultisampleRenderTarget(w, h, { format: THREE.RGBAFormat, encoding: THREE.LinearEncoding });
      target.samples = mobile ? 2 : 4;
    }
    composer = new THREE.EffectComposer(renderer, target);
    composer.setPixelRatio(renderer.getPixelRatio());
    composer.setSize(w, h);
    composer.addPass(new THREE.RenderPass(scene, camera));
    if (!mobile && THREE.SSAOPass && !DBG.nossao) {
      ssaoPass = new THREE.SSAOPass(scene, camera, w, h);
      ssaoPass.kernelRadius = 0.5; ssaoPass.minDistance = 0.0008; ssaoPass.maxDistance = 0.06;
      composer.addPass(ssaoPass);
    }
    if (THREE.UnrealBloomPass && !DBG.nobloom) {
      bloomPass = new THREE.UnrealBloomPass(new THREE.Vector2(w, h), 0.42, 0.65, 0.8);
      composer.addPass(bloomPass);
    }
    gradePass = new THREE.ShaderPass({
      uniforms: { tDiffuse: { value: null }, uVig: { value: 0.55 }, uSat: { value: 1.12 }, uTint: { value: new THREE.Color(1, 1, 1) } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `#include <common>
        uniform sampler2D tDiffuse; uniform float uVig; uniform float uSat; uniform vec3 uTint; varying vec2 vUv;
        void main(){ vec4 c = texture2D(tDiffuse, vUv);
          float d = distance(vUv, vec2(0.5)); c.rgb *= 1.0 - smoothstep(0.42, 0.98, d) * uVig;
          float l = dot(c.rgb, vec3(0.299, 0.587, 0.114)); c.rgb = mix(vec3(l), c.rgb, uSat) * uTint;
          gl_FragColor = LinearTosRGB(vec4(c.rgb, 1.0)); }`,
    });
    composer.addPass(gradePass);
    if (!target && THREE.FXAAShader) {
      const fx = new THREE.ShaderPass(THREE.FXAAShader);
      fx.material.uniforms.resolution.value.set(1 / (w * renderer.getPixelRatio()), 1 / (h * renderer.getPixelRatio()));
      composer.addPass(fx);
    }
  }

  /* ---------------- day / night ---------------- */
  function hourNow() {
    if (hourParam !== null && !isNaN(+hourParam)) return +hourParam;
    const d = new Date(); return d.getHours() + d.getMinutes() / 60;
  }
  function daylight(h) {
    const elev = Math.sin((h - 6) / 12 * Math.PI);           // >0 between 06:00 and 18:00
    const day = THREE.MathUtils.clamp(elev * 1.6, 0, 1);      // full day quickly after dawn
    const dusk = THREE.MathUtils.clamp(1 - Math.abs(elev) * 3.5, 0, 1); // warm band at sunrise/sunset
    return { elev, day, dusk, night: 1 - day };
  }
  function applyDaylight(t) {
    const h = hourNow(), L = daylight(h);
    const skyTop = lerpC(0x0a0e23, 0x3f8fe0, L.day).lerp(new THREE.Color(0x6a4fa8), L.dusk * 0.5);
    const skyMid = lerpC(0x151c40, 0xa9d6f5, L.day).lerp(new THREE.Color(0xf2a25c), L.dusk * 0.6);
    const skyBot = lerpC(0x1b2450, 0xd9ebf5, L.day).lerp(new THREE.Color(0xf7c98b), L.dusk * 0.6);
    sky.material.uniforms.top.value.copy(skyTop);
    sky.material.uniforms.mid.value.copy(skyMid);
    sky.material.uniforms.bot.value.copy(skyBot);
    scene.fog.color.copy(skyBot);
    hemi.color.copy(lerpC(0x2a3468, 0xdff0ff, L.day)); hemi.groundColor.copy(lerpC(0x0d1230, 0x6fa383, L.day));
    hemi.intensity = 0.25 + 0.35 * L.day;
    sun.color.copy(lerpC(0x8ea2ff, 0xfff3dd, L.day).lerp(new THREE.Color(0xffb070), L.dusk * 0.6));
    sun.intensity = 0.22 + 1.0 * L.day;
    const az = (h - 6) / 12 * Math.PI; // sweeps east→west
    const p = rig ? rig.g.position : new THREE.Vector3();
    sun.position.set(p.x + Math.cos(az) * 10, 6 + 9 * Math.max(L.elev, 0.25), p.z + 6 + Math.sin(az) * 3);
    sun.target.position.copy(p); sun.target.updateMatrixWorld();
    renderer.toneMappingExposure = 0.76 + 0.16 * L.day;
    if (stars) stars.material.opacity = L.night * 0.9;
    if (water) {
      water.material.uniforms.colDeep.value.copy(lerpC(0x0a1636, 0x3f9bc7, L.day));
      water.material.uniforms.colShallow.value.copy(lerpC(0x1b2f6b, 0x8fd9e8, L.day));
      water.material.uniforms.sunDir.value.copy(sun.position).normalize();
      water.material.uniforms.sunStr.value = 0.25 + 0.9 * L.day;
      water.material.uniforms.fogColor.value.copy(skyBot);
    }
    if (pollen) pollen.material.uniforms.uAlpha.value = L.day * 0.35;
    if (fireflies) fireflies.material.uniforms.uAlpha.value = L.night;
    beacons.forEach(b => { b.userData.gem.material.emissiveIntensity = 0.45 + 0.9 * L.night; });
    nightLights.forEach(l => { l.light.intensity = l.base * (0.15 + 0.85 * L.night); });
    if (bloomPass) { bloomPass.strength = 0.12 + 0.3 * L.night; bloomPass.threshold = 0.96 - 0.22 * L.night; bloomPass.radius = 0.45 + 0.15 * L.night; }
    if (gradePass) gradePass.uniforms.uTint.value.setRGB(1, 1 - L.night * 0.03, 1 + L.night * 0.05);
    clouds.forEach(c => c.children.forEach(m => { m.material.emissiveIntensity = 0.05 + 0.25 * L.day; m.material.color.copy(lerpC(0x3a4470, 0xffffff, L.day)); }));
  }

  /* ---------------- sky, water, textures ---------------- */
  function skyDome() {
    const m = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { top: { value: new THREE.Color(0x4f9be8) }, mid: { value: new THREE.Color(0xa9d6f5) }, bot: { value: new THREE.Color(0xe6f1f7) } },
      vertexShader: 'varying float h; void main(){ h = normalize(position).y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 top; uniform vec3 mid; uniform vec3 bot; varying float h; void main(){ float t = clamp(h, -0.05, 1.0); vec3 c = t < 0.22 ? mix(bot, mid, t/0.22) : mix(mid, top, pow((t-0.22)/0.78, 0.8)); gl_FragColor = vec4(c, 1.0); }',
    });
    return new THREE.Mesh(new THREE.SphereGeometry(150, 32, 16), m);
  }
  function nightStars() {
    const N = 500, pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const a = Math.random() * Math.PI * 2, e = 0.08 + Math.random() * 0.9, r = 140;
      pos[i * 3] = Math.cos(a) * Math.cos(e) * r; pos[i * 3 + 1] = Math.sin(e) * r; pos[i * 3 + 2] = Math.sin(a) * Math.cos(e) * r;
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    return new THREE.Points(g, new THREE.PointsMaterial({ color: 0xfff6dc, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false }));
  }
  function waterMaterial() {
    return new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 }, sunDir: { value: new THREE.Vector3(0.5, 0.8, 0.3) }, sunStr: { value: 1 },
        colDeep: { value: new THREE.Color(0x3f9bc7) }, colShallow: { value: new THREE.Color(0x8fd9e8) },
        fogColor: { value: new THREE.Color(0xd9ebf5) }, fogNear: { value: 34 }, fogFar: { value: 120 }, isleR: { value: ISLE_R + 0.4 },
      },
      vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: `#include <common>
        uniform float time; uniform vec3 sunDir; uniform float sunStr; uniform vec3 colDeep; uniform vec3 colShallow;
        uniform vec3 fogColor; uniform float fogNear; uniform float fogFar; uniform float isleR; varying vec3 vW;
        void main(){
          vec3 p = vW;
          float a = p.x*0.9 + time*1.1, b = p.z*1.3 - time*0.8, c = (p.x+p.z)*0.45 + time*0.5;
          float w = sin(a)*0.5 + sin(b)*0.35 + sin(c)*0.5;
          vec3 n = normalize(vec3(-cos(a)*0.28 - cos(c)*0.1, 1.0, -cos(b)*0.25 - cos(c)*0.1));
          vec3 V = normalize(cameraPosition - p);
          float fres = pow(1.0 - max(dot(n, V), 0.0), 3.0);
          float spec = pow(max(dot(reflect(-sunDir, n), V), 0.0), 90.0) * sunStr;
          float d = length(p.xz);
          float foam = smoothstep(isleR + 1.6, isleR + 0.2, d) * (0.55 + 0.45 * sin(d*5.0 - time*2.2 + w));
          vec3 col = mix(colDeep, colShallow, clamp(fres*0.8 + w*0.12 + 0.15, 0.0, 1.0));
          col += spec * vec3(1.0, 0.97, 0.9) + foam * 0.55;
          float fogF = smoothstep(fogNear, fogFar, length(cameraPosition - p));
          col = mix(col, fogColor, fogF);
          gl_FragColor = vec4(col, 1.0);
        }`,
    });
  }
  function grassTexture(hue) {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const x = c.getContext('2d');
    const base = new THREE.Color(hue).lerp(new THREE.Color(0x7fcf9f), 0.72);
    x.fillStyle = '#' + base.getHexString(); x.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 1600; i++) {
      x.fillStyle = '#' + base.clone().offsetHSL(0, 0, (Math.random() - 0.5) * 0.1).getHexString();
      x.fillRect(Math.random() * 256, Math.random() * 256, 2 + Math.random() * 4, 2 + Math.random() * 3);
    }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(9, 9); t.encoding = THREE.sRGBEncoding;
    return t;
  }
  function cloud(x, y, z, s) {
    const g = new THREE.Group();
    const n = 3 + Math.floor(rnd() * 3);
    for (let i = 0; i < n; i++) {
      const m = std(0xffffff, { roughness: 1, emissive: 0xffffff, emissiveIntensity: 0.25 });
      const o = new THREE.Mesh(new THREE.SphereGeometry((0.8 + rnd() * 0.9) * s, 14, 10), m);
      o.position.set((i - n / 2) * 1.1 * s + rnd() * 0.4, rnd() * 0.4 * s, (rnd() - 0.5) * 0.8 * s);
      o.scale.y = 0.62; g.add(o);
    }
    g.position.set(x, y, z); g.userData.speed = 0.15 + rnd() * 0.2;
    scene.add(g); return g;
  }

  /* ---------------- instanced grass, flowers, particles ---------------- */
  function onRoad(x, z, n) {
    const r = Math.hypot(x, z), th = Math.atan2(z, x);
    if (r < 1.75 || r > ISLE_R - 0.5 || Math.abs(r - RING_R) < 0.55) return true;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.PI / n;
      const dx = x - Math.cos(a) * BEACON_R, dz = z - Math.sin(a) * BEACON_R;
      if (Math.hypot(dx, dz) < 1.1) return true;
      let da = th - a; while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2;
      if (Math.cos(da) > 0 && r > 1.5 && r < RING_R + 0.5 && Math.abs(Math.sin(da)) * r < 0.5) return true;
    }
    return false;
  }
  function swayMaterial(base) {
    base.onBeforeCompile = sh => {
      sh.uniforms.uTime = grassU; sh.uniforms.uPlayer = grassPlayer;
      sh.vertexShader = 'uniform float uTime; uniform vec3 uPlayer;\n' + sh.vertexShader.replace('#include <begin_vertex>',
        `vec3 transformed = vec3(position);
         float wgt = clamp(position.y / 0.34, 0.0, 1.0);
         #ifdef USE_INSTANCING
           float ph = instanceMatrix[3].x * 0.8 + instanceMatrix[3].z * 1.1;
         #else
           float ph = 0.0;
         #endif
         float sw = sin(uTime * 1.7 + ph) * 0.09 * wgt + sin(uTime * 3.1 + ph * 2.0) * 0.02 * wgt;
         transformed.x += sw; transformed.z += sw * 0.5;
         #ifdef USE_INSTANCING
           vec2 away = instanceMatrix[3].xz - uPlayer.xz; float pd = length(away);
           float push = smoothstep(0.85, 0.0, pd) * 0.42 * wgt;
           transformed.xz += (pd > 0.001 ? normalize(away) : vec2(0.0)) * push; transformed.y -= push * 0.35;
         #endif`);
    };
    return base;
  }
  function plantGrass(hue, n, avoid) {
    const count = mobile ? 900 : 2200;
    const geo = new THREE.PlaneGeometry(0.09, 0.34, 1, 2); geo.translate(0, 0.17, 0);
    const mat = swayMaterial(std(0xffffff, { side: THREE.DoubleSide, roughness: 1 }));
    const grass = new THREE.InstancedMesh(geo, mat, count);
    grass.receiveShadow = true;
    const base = new THREE.Color(hue).lerp(new THREE.Color(0x5fc48a), 0.7);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), pos = new THREE.Vector3(), col = new THREE.Color();
    let placed = 0, tries = 0;
    while (placed < count && tries < count * 6) {
      tries++;
      const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * (ISLE_R - 0.6);
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (onRoad(x, z, n) || (avoid && Math.hypot(x - avoid.x, z - avoid.z) < avoid.r)) continue;
      pos.set(x, 0, z); q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rnd() * Math.PI); const sc = 0.7 + rnd() * 0.7; s.set(sc, sc, sc);
      m4.compose(pos, q, s); grass.setMatrixAt(placed, m4);
      col.copy(base).offsetHSL((rnd() - 0.5) * 0.04, 0, (rnd() - 0.5) * 0.14); grass.setColorAt(placed, col);
      placed++;
    }
    grass.count = placed; grass.instanceMatrix.needsUpdate = true; if (grass.instanceColor) grass.instanceColor.needsUpdate = true;
    scene.add(grass);
    // flowers
    const fcount = mobile ? 90 : 220;
    const fl = new THREE.InstancedMesh(new THREE.SphereGeometry(0.05, 8, 6), std(0xffffff, { roughness: 0.6 }), fcount);
    const palette = [new THREE.Color(hue).lerp(new THREE.Color(0xffffff), 0.35), new THREE.Color(0xffffff), new THREE.Color(0xf2c14e)];
    let f = 0; tries = 0;
    while (f < fcount && tries < fcount * 8) {
      tries++;
      const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * (ISLE_R - 0.8);
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (onRoad(x, z, n) || (avoid && Math.hypot(x - avoid.x, z - avoid.z) < avoid.r)) continue;
      m4.compose(new THREE.Vector3(x, 0.08, z), q, new THREE.Vector3(1, 1, 1)); fl.setMatrixAt(f, m4);
      fl.setColorAt(f, palette[Math.floor(rnd() * palette.length)]); f++;
    }
    fl.count = f; fl.instanceMatrix.needsUpdate = true; if (fl.instanceColor) fl.instanceColor.needsUpdate = true;
    scene.add(fl);
  }
  function particles(count, color, size, night) {
    const pos = new Float32Array(count * 3), seed = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * (ISLE_R - 0.5);
      pos[i * 3] = Math.cos(a) * r; pos[i * 3 + 1] = 0.3 + Math.random() * (night ? 1.6 : 3); pos[i * 3 + 2] = Math.sin(a) * r; seed[i] = Math.random() * 100;
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
    const m = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uAlpha: { value: 1 }, uColor: { value: new THREE.Color(color) }, uSize: { value: size }, uNight: { value: night ? 1 : 0 } },
      vertexShader: `attribute float seed; uniform float uTime; uniform float uSize; uniform float uNight; varying float vBlink;
        void main(){ vec3 p = position; float t = uTime * (uNight > 0.5 ? 0.35 : 0.15) + seed;
          p.x += sin(t * 1.3 + seed) * 0.6; p.z += cos(t * 0.9 + seed * 0.7) * 0.6; p.y += sin(t * 0.7 + seed * 1.3) * 0.4;
          vBlink = uNight > 0.5 ? smoothstep(0.35, 1.0, sin(uTime * 2.2 + seed * 3.1)) : 0.7;
          vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_PointSize = uSize * (34.0 / max(-mv.z, 1.0)); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform vec3 uColor; uniform float uAlpha; varying float vBlink;
        void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.05, d) * uAlpha * vBlink; gl_FragColor = vec4(uColor, a); }`,
    });
    const pts = new THREE.Points(g, m); scene.add(pts); return pts;
  }

  /* ---------------- biomes ---------------- */
  function landmarkAngle(n) {
    let best = 0, bd = 9;
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; let d = Math.abs(((a - 1.5 * Math.PI) + Math.PI * 3) % (Math.PI * 2) - Math.PI); if (d < bd) { bd = d; best = a; } }
    return best;
  }
  function addNightLight(color, intensity, dist, x, y, z) {
    const l = new THREE.PointLight(color, intensity, dist); l.position.set(x, y, z); scene.add(l);
    nightLights.push({ light: l, base: intensity }); return l;
  }
  function biome(isle, hue, n) {
    const a = landmarkAngle(n), R = 3.9, x = Math.cos(a) * R, z = Math.sin(a) * R;
    const kitLandmark = window.NumeraAssets ? NumeraAssets.landmark(isle.id) : null;
    if (kitLandmark) { kitLandmark.position.set(x, 0, z); kitLandmark.rotation.y = -a + Math.PI / 2; scene.add(kitLandmark); addNightLight(hue, 1.4, 7, x, 2.2, z); return { x, z, r: 2.8 }; }
    const rock = std(0x6e6a78), dark = std(0x1a1d33, { roughness: 0.5, metalness: 0.2 });
    switch (isle.id) {
      case 'ember': { // lighthouse
        for (let i = 0; i < 4; i++) put(new THREE.CylinderGeometry(0.42 - i * 0.04, 0.46 - i * 0.04, 0.55, 20), std(i % 2 ? 0xe8503f : 0xe6e2d9), x, 0.275 + i * 0.55, z);
        put(new THREE.CylinderGeometry(0.34, 0.34, 0.45, 16), std(0xfff3c4, { emissive: 0xffd77a, emissiveIntensity: 1.2, transparent: true, opacity: 0.85 }), x, 2.42, z);
        put(new THREE.ConeGeometry(0.45, 0.4, 16), std(0x2a3a7a), x, 2.85, z);
        addNightLight(0xffd77a, 2.2, 9, x, 2.45, z);
        for (let i = 0; i < 3; i++) { const l = put(new THREE.CylinderGeometry(0.06, 0.09, 1.2, 7), std(0x8a6a48), x + Math.cos(i * 2.1) * 1.3, 0.08, z + Math.sin(i * 2.1) * 1.3); l.rotation.set(Math.PI / 2, 0, i * 1.3); }
        break;
      }
      case 'signs': { // obsidian monoliths + mirror pool
        for (let i = 0; i < 5; i++) { const t = (i - 2) * 0.55; const m = put(new THREE.BoxGeometry(0.35, 1.4 + Math.abs(t), 0.22), dark, x + Math.cos(a + Math.PI / 2) * t * 1.6, 0.7 + Math.abs(t) / 2, z + Math.sin(a + Math.PI / 2) * t * 1.6); m.rotation.y = a; m.rotation.z = t * 0.12; }
        flat(new THREE.CircleGeometry(1.1, 32), std(0x0a0e23, { metalness: 0.95, roughness: 0.08 }), x - Math.cos(a) * 1.4, 0.015, z - Math.sin(a) * 1.4);
        addNightLight(0x8b7cf6, 1.6, 7, x, 1.4, z);
        break;
      }
      case 'fraction': { // tide pools + split boulders
        for (let i = 0; i < 4; i++) { const px = x + Math.cos(i * 1.6) * 1.4, pz = z + Math.sin(i * 1.6) * 1.4; flat(new THREE.CircleGeometry(0.5 + (i % 2) * 0.25, 24), std(0x62c9de, { transparent: true, opacity: 0.8, roughness: 0.1, metalness: 0.3 }), px, 0.02, pz); flat(new THREE.RingGeometry(0.5 + (i % 2) * 0.25, 0.62 + (i % 2) * 0.25, 24), std(0x8f8a80), px, 0.021, pz); }
        [-1, 1].forEach(s => { const b = put(new THREE.SphereGeometry(0.55, 16, 12, s > 0 ? 0 : Math.PI, Math.PI), rock, x + s * 0.42, 0.3, z); b.rotation.y = a; });
        break;
      }
      case 'delta': { // glass shards
        for (let i = 0; i < 6; i++) { const g = put(new THREE.BoxGeometry(0.22, 1.2 + (i % 3) * 0.6, 0.22), new THREE.MeshPhysicalMaterial({ color: 0xbfe9ff, transparent: true, opacity: 0.55, roughness: 0.05, metalness: 0.1 }), x + Math.cos(i) * 0.9, 0.6 + (i % 3) * 0.3, z + Math.sin(i) * 0.9); g.rotation.set((rnd() - 0.5) * 0.4, i, (rnd() - 0.5) * 0.4); }
        addNightLight(0x9fd8ff, 1.4, 6, x, 1.2, z);
        break;
      }
      case 'ratio': { // coral in a 3 : 5 ratio
        for (let i = 0; i < 8; i++) { const m = std(i < 3 ? 0xe85d5d : 0xf2c14e, { roughness: 0.7 }); const px = x + Math.cos(i * 0.8) * (0.7 + (i % 2) * 0.6), pz = z + Math.sin(i * 0.8) * (0.7 + (i % 2) * 0.6); put(new THREE.ConeGeometry(0.16, 0.9, 7), m, px, 0.45, pz); put(new THREE.ConeGeometry(0.1, 0.5, 6), m, px + 0.16, 0.6, pz).rotation.z = -0.6; put(new THREE.ConeGeometry(0.1, 0.5, 6), m, px - 0.14, 0.7, pz + 0.1).rotation.z = 0.5; }
        break;
      }
      case 'exponent': { // doubling stairs
        const hs = [0.3, 0.6, 1.2, 2.4], rs = [1.9, 1.45, 1.0, 0.6];
        hs.forEach((h, i) => put(new THREE.CylinderGeometry(rs[i], rs[i] + 0.15, h, 10), std(lerpC(hue, 0x6e6a78, 0.5 + i * 0.1)), x - Math.cos(a) * 0.6, h / 2, z - Math.sin(a) * 0.6));
        addNightLight(hue, 1.2, 6, x, 2.8, z);
        break;
      }
      case 'algebra': { // the crossed stones of x
        [-1, 1].forEach(s => { const b = put(new THREE.BoxGeometry(0.4, 2.6, 0.4), rock, x, 1.2, z); b.rotation.y = a; b.rotation.z = s * 0.6; });
        flat(new THREE.RingGeometry(1.2, 1.35, 40), std(0xcfc8b8), x, 0.015, z);
        addNightLight(0xf26b8a, 1.3, 6, x, 1.6, z);
        break;
      }
      case 'geometry': { // polygon pillars 3-4-5-6-8
        [3, 4, 5, 6, 8].forEach((k, i) => { const h = 0.7 + i * 0.35; const p = put(new THREE.CylinderGeometry(0.32, 0.32, h, k), std(lerpC(hue, 0xffffff, 0.15 + i * 0.12)), x + Math.cos(a + Math.PI / 2) * (i - 2) * 0.85, h / 2, z + Math.sin(a + Math.PI / 2) * (i - 2) * 0.85); p.rotation.y = a; });
        break;
      }
      case 'func': { // waterfall
        put(new THREE.BoxGeometry(2.6, 2.4, 1.2), rock, x - Math.cos(a) * 0.5, 1.2, z - Math.sin(a) * 0.5).rotation.y = -a;
        const fall = put(new THREE.PlaneGeometry(0.9, 2.3), std(0x9fe3f0, { transparent: true, opacity: 0.75, roughness: 0.1, emissive: 0x6fd6ee, emissiveIntensity: 0.15 }), x + Math.cos(a) * 0.12, 1.2, z + Math.sin(a) * 0.12, false); fall.rotation.y = -a + Math.PI / 2;
        flat(new THREE.CircleGeometry(1.2, 32), std(0x62c9de, { transparent: true, opacity: 0.8, roughness: 0.1 }), x + Math.cos(a) * 1.1, 0.02, z + Math.sin(a) * 1.1);
        anims.push(t => { fall.material.opacity = 0.65 + Math.sin(t * 6) * 0.1; fall.position.y = 1.2 + Math.sin(t * 9) * 0.02; });
        break;
      }
      case 'trig': { // ring temple
        for (let i = 0; i < 8; i++) put(new THREE.CylinderGeometry(0.12, 0.14, 1.6, 12), std(0xe9e2d0), x + Math.cos(i / 8 * Math.PI * 2) * 1.4, 0.8, z + Math.sin(i / 8 * Math.PI * 2) * 1.4);
        put(new THREE.TorusGeometry(1.4, 0.1, 10, 40), std(0xe9e2d0), x, 1.62, z).rotation.x = Math.PI / 2;
        flat(new THREE.CircleGeometry(1.2, 40), std(0xd8cfb8), x, 0.015, z);
        addNightLight(0xf2a25c, 1.4, 7, x, 1.2, z);
        break;
      }
      case 'chance': { // dice and mist
        for (let i = 0; i < 3; i++) { const d = put(new THREE.BoxGeometry(0.6, 0.6, 0.6), std(0xfaf7f2, { roughness: 0.5 }), x + Math.cos(i * 2.1) * 0.9, 0.3, z + Math.sin(i * 2.1) * 0.9); d.rotation.y = i * 0.7; for (let k = 0; k < 3; k++) put(new THREE.SphereGeometry(0.05, 8, 6), std(0x1a1d33), d.position.x + (k - 1) * 0.16, 0.61, d.position.z + (k - 1) * 0.16, false); }
        for (let i = 0; i < 5; i++) { const w = flat(new THREE.CircleGeometry(0.8 + rnd() * 0.6, 20), std(0xffffff, { transparent: true, opacity: 0.22, roughness: 1, depthWrite: false }), x + (rnd() - 0.5) * 3, 0.3 + rnd() * 0.3, z + (rnd() - 0.5) * 3); const ph = rnd() * 6; anims.push(t => { w.position.x += Math.sin(t * 0.3 + ph) * 0.002; w.material.opacity = 0.16 + Math.sin(t * 0.6 + ph) * 0.06; }); }
        addNightLight(0xb78ef2, 1.2, 6, x, 1, z);
        break;
      }
      case 'calculus': { // the caldera
        put(new THREE.TorusGeometry(1.9, 0.55, 10, 40), std(0x3a2f3d), x, 0.1, z).rotation.x = Math.PI / 2;
        const lava = flat(new THREE.CircleGeometry(1.4, 40), std(0xff7a3d, { emissive: 0xff5a1f, emissiveIntensity: 1.6, roughness: 1 }), x, 0.06, z);
        const l = addNightLight(0xff7a3d, 2.5, 8, x, 1, z);
        anims.push(t => { lava.material.emissiveIntensity = 1.4 + Math.sin(t * 2.3) * 0.3; l.intensity *= 1 + Math.sin(t * 4.1) * 0.08; });
        break;
      }
    }
    return { x, z, r: 2.6 };
  }

  /* ---------------- composed layout ----------------
     Deliberate placement, the way a level designer would do it: tree groves in the
     gaps between spokes framing the landmark, a town arc outside the ring, rocks along
     the rim, bushes flanking each plaza, a lamp at every beacon. Kit models are used
     for any kind the manifest provides; the rest are stylized primitives. */
  const COMP = {
    ember: { groves: 2, per: 3, rocks: 5, houses: 5 }, signs: { groves: 1, per: 3, rocks: 8, houses: 3 }, fraction: { groves: 2, per: 4, rocks: 6, houses: 4 },
    delta: { groves: 1, per: 2, rocks: 3, houses: 7 }, ratio: { groves: 2, per: 3, rocks: 7, houses: 4 }, exponent: { groves: 1, per: 3, rocks: 9, houses: 3 },
    algebra: { groves: 3, per: 4, rocks: 3, houses: 5 }, geometry: { groves: 3, per: 5, rocks: 4, houses: 3 }, func: { groves: 2, per: 4, rocks: 6, houses: 4 },
    trig: { groves: 2, per: 3, rocks: 4, houses: 6 }, chance: { groves: 2, per: 3, rocks: 5, houses: 4 }, calculus: { groves: 1, per: 2, rocks: 10, houses: 2 },
  };
  let kitCounter = 0;
  function placeKind(kind, x, z, rotDeg, scale, hue, n, avoid) {
    if (onRoad(x, z, n) || (avoid && Math.hypot(x - avoid.x, z - avoid.z) < avoid.r)) return null;
    const kit = window.NumeraAssets ? NumeraAssets.get(kind, kitCounter++) : null;
    if (kit) { kit.position.set(x, 0, z); kit.rotation.y = rotDeg * Math.PI / 180; kit.scale.multiplyScalar(scale); scene.add(kit); return kit; }
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rotDeg * Math.PI / 180; g.scale.setScalar(scale); scene.add(g);
    const add = (geo, m, y, sh) => { const o = new THREE.Mesh(geo, m); o.position.y = y; o.castShadow = sh !== false; o.receiveShadow = true; g.add(o); return o; };
    switch (kind) {
      case 'tree': { const leaf = std(hue.clone().lerp(new THREE.Color(0x2f9a5c), 0.75)), trunk = std(0x6b4b2e); add(new THREE.CylinderGeometry(0.06, 0.1, 1.0, 8), trunk, 0.5); const c = add(new THREE.SphereGeometry(0.62, 16, 12), leaf, 1.35); c.scale.y = 1.25; add(new THREE.SphereGeometry(0.4, 14, 10), leaf, 1.95).position.x = 0.25; break; }
      case 'bush': { const c = add(new THREE.SphereGeometry(0.42, 14, 10), std(hue.clone().lerp(new THREE.Color(0x3aa86a), 0.7)), 0.28); c.scale.set(1.3, 0.75, 1.1); break; }
      case 'rock': { const r = add(new THREE.DodecahedronGeometry(0.42, 0), std(0x7a7887, { flatShading: true }), 0.25); r.scale.set(1.3, 0.8, 1); r.rotation.y = rotDeg; break; }
      case 'house': { const w = 0.9 + (kitCounter % 3) * 0.2; add(new THREE.BoxGeometry(w, 0.9, 0.9), std(0xf4efe4), 0.45); add(new THREE.ConeGeometry(0.85, 0.7, 4), std(hue.clone().lerp(new THREE.Color(0xc25b4a), 0.6)), 1.25).rotation.y = Math.PI / 4; add(new THREE.BoxGeometry(0.2, 0.3, 0.05), std(0x5b3d24), 0.35).position.z = 0.46; break; }
      case 'lamp': { add(new THREE.CylinderGeometry(0.035, 0.05, 1.7, 8), std(0x2c3050), 0.85); add(new THREE.SphereGeometry(0.11, 10, 8), std(0xffe9a8, { emissive: 0xffd77a, emissiveIntensity: 1.2 }), 1.8, false); addNightLight(0xffd77a, 1.2, 4.5, x, 1.8, z); break; }
      case 'prop': { add(new THREE.BoxGeometry(0.45, 0.45, 0.45), std(0x9a7a4a), 0.225); break; }
    }
    return g;
  }
  function compose(isle, hue, n, avoid) {
    const c = COMP[isle.id] || COMP.ember; kitCounter = isleSeed % 7;
    const lmA = Math.atan2(avoid.z, avoid.x);
    const dAng = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
    const FRONT = Math.PI / 2; // the camera looks in from +z; nothing tall may stand between it and the wanderer
    const gaps = []; for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; if (dAng(a, lmA) > 0.3 && dAng(a, FRONT) > 0.85) gaps.push(a); }
    gaps.sort((a, b) => dAng(b, FRONT) - dAng(a, FRONT)); // farthest from the camera first
    // groves: tight clusters in the gaps, sized big → small toward the edge, framing the landmark
    gaps.slice(0, c.groves).forEach((a, gi) => {
      const r0 = 3.6 + (gi % 2) * 0.5, cx = Math.cos(a) * r0, cz = Math.sin(a) * r0;
      for (let k = 0; k < c.per; k++) { const ang = k * 2.4 + gi, rad = k === 0 ? 0 : 0.8 + (k % 2) * 0.55; placeKind('tree', cx + Math.cos(ang) * rad, cz + Math.sin(ang) * rad, rnd() * 360, k === 0 ? 1.0 : 0.7 + rnd() * 0.25, hue, n, avoid); }
      placeKind('bush', cx + 1.2, cz - 0.4, rnd() * 360, 0.9, hue, n, avoid); placeKind('rock', cx - 1.1, cz + 0.6, rnd() * 360, 0.7, hue, n, avoid);
    });
    // town: an arc of houses outside the ring in the gap facing the camera, doors toward the center
    const townA = gaps.length ? gaps.reduce((best, a) => dAng(a, FRONT + 1.4) < dAng(best, FRONT + 1.4) ? a : best, gaps[0]) : FRONT + 1.4; // front-right, out of the sight line
    for (let k = 0; k < c.houses; k++) { const a = townA + (k - (c.houses - 1) / 2) * 0.17, r = 7.2 + (k % 2) * 0.7; placeKind('house', Math.cos(a) * r, Math.sin(a) * r, -a * 180 / Math.PI - 90, 0.9 + rnd() * 0.2, hue, n, avoid); }
    placeKind('lamp', Math.cos(townA) * 6.5, Math.sin(townA) * 6.5, 0, 1, hue, n, avoid);
    placeKind('prop', Math.cos(townA + 0.25) * 6.6, Math.sin(townA + 0.25) * 6.6, 20, 1, hue, n, avoid);
    // rocks along the rim, and a lamp beside every beacon plaza
    for (let k = 0; k < c.rocks; k++) { const a = k / c.rocks * Math.PI * 2 + rnd() * 0.3, r = 8.1 + rnd() * 0.5; placeKind('rock', Math.cos(a) * r, Math.sin(a) * r, rnd() * 360, 0.6 + rnd() * 0.8, hue, n, avoid); }
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 + Math.PI / n, side = new THREE.Vector3(-Math.sin(a), 0, Math.cos(a)); const p = new THREE.Vector3(Math.cos(a), 0, Math.sin(a)).multiplyScalar(5.85).add(side.clone().multiplyScalar(0.8)); placeKind('lamp', p.x, p.z, 0, 0.9, hue, n, null); placeKind('bush', p.x - side.x * 1.6, p.z - side.z * 1.6, rnd() * 360, 0.8, hue, n, null); }
  }

  /* ---------------- scene ---------------- */
  function buildScene(isle, isleIndex, skills) {
    isleSeed = isleIndex * 2711 + 13;
    beacons = []; clouds = []; nightLights = []; anims = []; curIsle = isle; curSkills = skills; curIsleIndex = isleIndex;
    scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0xcfe3f2, 34, 120);
    camera = new THREE.PerspectiveCamera(50, 16 / 9, 0.1, 400);
    camera.position.set(0, 3.7, 8.8); camera.lookAt(0, 1.1, 0);
    sky = skyDome(); scene.add(sky);
    stars = nightStars(); scene.add(stars);
    hemi = new THREE.HemisphereLight(0xdff0ff, 0x6fa383, 0.55); scene.add(hemi);
    sun = new THREE.DirectionalLight(0xfff3dd, 1.2); sun.castShadow = true;
    sun.shadow.mapSize.set(mobile ? 1024 : 2048, mobile ? 1024 : 2048);
    sun.shadow.camera.left = sun.shadow.camera.bottom = -12; sun.shadow.camera.right = sun.shadow.camera.top = 12;
    sun.shadow.camera.near = 2; sun.shadow.camera.far = 45; sun.shadow.bias = -0.0006;
    scene.add(sun); scene.add(sun.target);

    // sea + far isles
    water = new THREE.Mesh(new THREE.CircleGeometry(170, 64), waterMaterial()); water.rotation.x = -Math.PI / 2; water.position.y = -0.55; scene.add(water);
    for (let i = 0; i < 5; i++) { const a = rnd() * Math.PI * 2, d = 34 + rnd() * 22; const far = put(new THREE.SphereGeometry(4 + rnd() * 5, 16, 10), std(0x9fd3c0), Math.cos(a) * d, -1.2, Math.sin(a) * d, false); far.scale.y = 0.28 + rnd() * 0.12; }

    // the isle
    const hue = new THREE.Color(isle.hue);
    const top = put(new THREE.CylinderGeometry(ISLE_R, ISLE_R + 0.4, 0.5, 64), std(0xffffff, { map: grassTexture(isle.hue), roughness: 1 }), 0, -0.25, 0); top.castShadow = false;
    put(new THREE.CylinderGeometry(ISLE_R + 0.4, ISLE_R - 1.5, 1.6, 64), std(hue.clone().lerp(new THREE.Color(0x6b5a4a), 0.7)), 0, -1.3, 0, false);

    // roads: ring, spokes, plazas
    const road = std(0x5b6474, { roughness: 0.95 }), edge = std(0xf4d36a, { roughness: 0.8 }), stone = std(0xcfd5da);
    const ringW = 0.7;
    flat(new THREE.RingGeometry(RING_R - ringW / 2, RING_R + ringW / 2, 96), road, 0, 0.012, 0);
    flat(new THREE.RingGeometry(RING_R - ringW / 2 - 0.09, RING_R - ringW / 2, 96), edge, 0, 0.014, 0);
    flat(new THREE.RingGeometry(RING_R + ringW / 2, RING_R + ringW / 2 + 0.09, 96), edge, 0, 0.014, 0);
    flat(new THREE.CircleGeometry(1.5, 40), stone, 0, 0.012, 0);
    flat(new THREE.RingGeometry(1.5, 1.62, 40), edge, 0, 0.014, 0);
    const n = skills.length;
    skills.forEach((sk, i) => {
      const a = (i / n) * Math.PI * 2 + Math.PI / n, dir = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
      const len = RING_R - 1.5 + 0.35, mid = 1.5 + len / 2;
      const spoke = flat(new THREE.PlaneGeometry(0.62, len), road, dir.x * mid, 0.011, dir.z * mid); spoke.rotation.z = -a + Math.PI / 2;
      [-1, 1].forEach(s => { const off = new THREE.Vector3(-dir.z, 0, dir.x).multiplyScalar(s * 0.35); const e = flat(new THREE.PlaneGeometry(0.08, len), edge, dir.x * mid + off.x, 0.013, dir.z * mid + off.z); e.rotation.z = -a + Math.PI / 2; });
      const bp = dir.clone().multiplyScalar(BEACON_R);
      flat(new THREE.CircleGeometry(0.95, 32), stone, bp.x, 0.012, bp.z);
      const color = STATE_COLOR[Math.min(3, sk.crowns)];
      const grp = new THREE.Group(); grp.position.copy(bp);
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 2.4, 16), std(0xbfe9ff, { transparent: true, opacity: 0.5, roughness: 0.2, emissive: 0x9fd8ff, emissiveIntensity: 0.15 })); pillar.position.y = 1.2; grp.add(pillar);
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.62, 0.12, 24), std(color, { emissive: color, emissiveIntensity: 0.25 })); disc.position.y = 0.06; disc.castShadow = true; grp.add(disc);
      const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.42), std(color, { emissive: color, emissiveIntensity: 0.6, roughness: 0.25 })); gem.position.y = 2.95; gem.castShadow = true; grp.add(gem);
      const halo = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.03, 8, 40), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.75 })); halo.position.y = 2.95; halo.rotation.x = Math.PI / 2; grp.add(halo);
      grp.userData = { id: sk.id, i, gem, halo }; scene.add(grp); beacons.push(grp);
    });

    // landmark (kit model when present), then a composed layout instead of random scatter
    const avoid = biome(isle, hue, n); landmarkZone = avoid;
    compose(isle, hue, n, avoid);
    tapMarker = new THREE.Mesh(new THREE.RingGeometry(0.22, 0.34, 32), new THREE.MeshBasicMaterial({ color: 0xf2c14e, transparent: true, opacity: 0, depthWrite: false }));
    tapMarker.rotation.x = -Math.PI / 2; tapMarker.position.y = 0.03; tapMarker.visible = false; scene.add(tapMarker);
    plantGrass(isle.hue, n, avoid);
    for (let i = 0; i < 9; i++) clouds.push(cloud((rnd() - 0.5) * 60, 11 + rnd() * 6, -14 - rnd() * 30, 1.2 + rnd() * 1.2));
    pollen = particles(mobile ? 60 : 140, 0xfff2c4, 2.4, false);
    fireflies = particles(mobile ? 50 : 110, 0xf2c14e, 3.6, true);

    placeCharacter();
    fx = window.NumeraFX ? NumeraFX.create(scene, { hue, beacons, isleR: ISLE_R }) : null;
    if (fx) fx.setCompanions(companions.count, companions.stars);
    strideAcc = 0; lastPlayerPos = null;
    applyDaylight(0);
  }
  function placeCharacter() {
    const prev = rig ? { p: rig.g.position.clone(), r: rig.g.rotation.y } : null;
    if (rig) scene.remove(rig.g);
    rig = NumeraAvatar.buildCharacter({ lightIntensity: 0.6 });
    if (prev) { rig.g.position.copy(prev.p); rig.g.rotation.y = prev.r; } else { rig.g.position.set(0, 0, 2.2); rig.g.rotation.y = Math.PI; }
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

  /* ---------------- frame ---------------- */
  function frame(t) {
    const s = t / 1000, dt = lastT ? Math.min(0.05, (t - lastT) / 1000) : 0.016; lastT = t;
    grassU.value = s;
    if (water) water.material.uniforms.time.value = s;
    if (pollen) pollen.material.uniforms.uTime.value = s;
    if (fireflies) fireflies.material.uniforms.uTime.value = s;
    anims.forEach(f => f(s));
    beacons.forEach((b, i) => {
      b.userData.gem.rotation.y = s * 0.8 + i; b.userData.gem.position.y = 2.95 + Math.sin(s * 1.4 + i) * 0.1;
      b.userData.halo.rotation.z = s * 0.5; b.userData.halo.scale.setScalar(1 + Math.sin(s * 2 + i) * 0.06);
    });
    clouds.forEach(c => { c.position.x += c.userData.speed * dt; if (c.position.x > 40) c.position.x = -40; });
    if (tapMarker && markerT >= 0) { const p = (t - markerT) / 700; if (p >= 1) { tapMarker.visible = false; markerT = -1; } else { tapMarker.visible = true; tapMarker.scale.setScalar(0.6 + p * 1.1); tapMarker.material.opacity = 0.9 * (1 - p); } }
    if (rig) {
      if (!reduced) {
        if (walk.target) {
          const d = walk.target.clone().sub(rig.g.position); d.y = 0;
          const dist = d.length();
          if (dist < 0.1) {
            walk.target = null; walk.pauseUntil = t + (walk.manual ? 9000 : 1500 + Math.random() * 3000);
            const cb = walk.onArrive; walk.onArrive = null; walk.manual = false; if (cb) cb();
          }
          else {
            walk.speed = Math.min(1, walk.speed + 1.8 * dt); // frame-rate independent ramp (~0.55 s to full stride)
            rig.g.position.add(d.normalize().multiplyScalar((walk.manual ? 1.9 : 1.35) * walk.speed * dt));
            const want = Math.atan2(d.x, d.z);
            let diff = want - rig.g.rotation.y;
            while (diff > Math.PI) diff -= Math.PI * 2; while (diff < -Math.PI) diff += Math.PI * 2;
            rig.g.rotation.y += diff * 0.08;
          }
        } else { walk.speed = Math.max(0, walk.speed - 3 * dt); if (t > walk.pauseUntil) walk.target = pickTarget(); }
        const p = rig.g.position;
        // orbit camera: user-controlled yaw / pitch / distance, with a punch-in on beacon arrival
        let punch = 0; if (cam.punchT >= 0) { const q = (t - cam.punchT) / 1600; if (q >= 1) cam.punchT = -1; else punch = Math.sin(q * Math.PI) * 0.22; }
        const d = cam.dist * (1 - punch), cp = Math.cos(cam.pitch);
        const want = new THREE.Vector3(p.x + Math.sin(cam.yaw) * cp * d, p.y + Math.sin(cam.pitch) * d, p.z + Math.cos(cam.yaw) * cp * d);
        camera.position.lerp(want, gesture.type === 'orbit' || gesture.type === 'pinch' ? 0.35 : 0.08);
        camera.lookAt(p.x - Math.sin(cam.yaw) * 2.2 * (1 - punch), 1.1, p.z - Math.cos(cam.yaw) * 2.2 * (1 - punch));
        // strides → dust + footsteps
        if (lastPlayerPos) { strideAcc += p.distanceTo(lastPlayerPos); if (strideAcc > 0.62 && walk.speed > 0.2) { strideAcc = 0; if (fx) fx.step(p, rig.g.rotation.y); if (window.NumeraAudio) NumeraAudio.step(); } }
        lastPlayerPos = p.clone();
        grassPlayer.value.copy(p);
        if (window.NumeraAudio) { let near = 9; beacons.forEach(b => { near = Math.min(near, b.position.distanceTo(p)); }); NumeraAudio.beaconProximity(1 - Math.min(1, Math.max(0, (near - 1.2) / 3))); }
      }
      rig.animate(s, walk.speed, dt);
      if (fx) fx.update({ t: s, dt, player: rig.g.position, L: daylight(hourNow()) });
    }
    applyDaylight(s);
    if (window.NumeraAudio && (t | 0) % 60 === 0) NumeraAudio.setDaylight(daylight(hourNow()).day);
    if (composer) composer.render(dt); else renderer.render(scene, camera);
    placeLabels();
  }
  function placeLabels() {
    if (!labelWrap) return;
    const w = renderer.domElement.clientWidth, h = renderer.domElement.clientHeight;
    beacons.forEach((b, i) => {
      const el = labels[i]; if (!el) return;
      const v = b.position.clone(); v.y += 3.75; v.project(camera);
      el.style.opacity = (v.z > 1 || Math.abs(v.x) > 1.02 || Math.abs(v.y) > 1.02) ? '0' : '1';
      el.style.left = ((v.x * 0.5 + 0.5) * w) + 'px'; el.style.top = ((-v.y * 0.5 + 0.5) * h) + 'px';
    });
  }
  let fatalCb = null, frameErrors = 0;
  function loop(t) {
    if (!running) return;
    if (!document.hidden) { try { frame(t); frameErrors = 0; } catch (e) { console.error(e); if (++frameErrors > 3) { running = false; if (fatalCb) fatalCb(e); return; } } }
    requestAnimationFrame(loop);
  }
  /* ---- gestures: tap = walk there (or approach a beacon), drag = orbit the camera, pinch / wheel = zoom */
  function setPointer(x, y) {
    const r = renderer.domElement.getBoundingClientRect();
    ptr.x = ((x - r.left) / r.width) * 2 - 1; ptr.y = -((y - r.top) / r.height) * 2 + 1;
    ray.setFromCamera(ptr, camera);
  }
  function clampToIsle(p) {
    const r = Math.hypot(p.x, p.z), maxR = ISLE_R - 0.9;
    if (r > maxR) { p.x *= maxR / r; p.z *= maxR / r; }
    if (landmarkZone) { const dx = p.x - landmarkZone.x, dz = p.z - landmarkZone.z, d = Math.hypot(dx, dz); if (d < landmarkZone.r) { const k = landmarkZone.r / Math.max(d, 1e-3); p.x = landmarkZone.x + dx * k; p.z = landmarkZone.z + dz * k; } }
    p.y = 0; return p;
  }
  function walkTo(p, onArrive, showMarker) {
    if (!rig) return;
    walk.target = clampToIsle(p.clone()); walk.manual = true; walk.onArrive = onArrive || null;
    if (showMarker && tapMarker) { tapMarker.position.set(walk.target.x, 0.03, walk.target.z); markerT = performance.now(); }
    if (window.NumeraAudio) NumeraAudio.tap();
  }
  function tapAt(x, y) {
    if (!rig) return;
    setPointer(x, y);
    const hits = ray.intersectObjects(beacons, true);
    if (hits.length) {
      let o = hits[0].object; while (o && !o.userData.id) o = o.parent;
      if (o) { const id = o.userData.id; const toward = o.position.clone().multiplyScalar(1 - 1.25 / o.position.length()); // stop at the plaza edge
        walkTo(toward, () => { cam.punchT = performance.now(); if (onSkillCb) setTimeout(() => onSkillCb(id), 350); }, true); }
      return;
    }
    const hit = new THREE.Vector3();
    if (ray.ray.intersectPlane(groundPlane, hit)) walkTo(hit, null, true);
  }
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  function onPointerDown(e) {
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 1) gesture = { type: 'pending', x0: e.clientX, y0: e.clientY, t0: performance.now(), lastX: e.clientX, lastY: e.clientY };
    else if (pointers.size === 2) { const [a, b] = [...pointers.values()]; gesture = { type: 'pinch', d0: Math.hypot(a.x - b.x, a.y - b.y), dist0: cam.dist }; }
  }
  function onPointerMove(e) {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (gesture.type === 'pinch' && pointers.size === 2) {
      const [a, b] = [...pointers.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      cam.dist = clamp(gesture.dist0 * gesture.d0 / d, 3.5, 14); cam.zoomed = true; return;
    }
    if (gesture.type === 'pending' && Math.hypot(e.clientX - gesture.x0, e.clientY - gesture.y0) > 8) gesture.type = 'orbit';
    if (gesture.type === 'orbit') {
      const dx = e.clientX - gesture.lastX, dy = e.clientY - gesture.lastY;
      cam.yaw -= dx * 0.0065; cam.pitch = clamp(cam.pitch + dy * 0.0045, 0.12, 1.2);
      gesture.lastX = e.clientX; gesture.lastY = e.clientY;
    }
  }
  function onPointerUp(e) {
    const was = gesture; pointers.delete(e.pointerId);
    if (was.type === 'pending' && performance.now() - was.t0 < 500) tapAt(e.clientX, e.clientY);
    if (pointers.size === 0) gesture = { type: 'none' };
    else if (pointers.size === 1) { const [p] = [...pointers.values()]; gesture = { type: 'orbit', lastX: p.x, lastY: p.y }; }
  }
  function onWheel(e) { e.preventDefault(); cam.dist = clamp(cam.dist * (1 + e.deltaY * 0.0012), 3.5, 14); cam.zoomed = true; }
  function resize() {
    if (!renderer || !container || !container.isConnected) return;
    const w = container.clientWidth || 800, h = container.clientHeight || 520;
    renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix();
    if (!cam.zoomed) cam.dist = camera.aspect < 1 ? 8.4 : 6.8;
    if (composer) { composer.setSize(w, h); const fx = composer.passes.find(p => p.material && p.material.uniforms && p.material.uniforms.resolution); if (fx) fx.material.uniforms.resolution.value.set(1 / (w * renderer.getPixelRatio()), 1 / (h * renderer.getPixelRatio())); }
  }

  /* mount(container, labelWrap, isle, isleIndex, skills[{id,name,crowns}], onSkill) → false if no 3D */
  function mount(cont, lw, isle, isleIndex, skills, onSkill) {
    ensureRenderer();
    if (!renderer) return false;
    container = cont; labelWrap = lw; onSkillCb = onSkill; mountCount++;
    buildScene(isle, isleIndex, skills);
    cont.innerHTML = ''; cont.appendChild(renderer.domElement);
    const w = cont.clientWidth || 800, h = cont.clientHeight || 520;
    buildComposer(w, h);
    lw.innerHTML = '';
    labels = skills.map(sk => {
      const el = document.createElement('button'); el.className = 'isleLabel';
      el.innerHTML = `${sk.name}<i>${'♛'.repeat(sk.crowns) || '·'}</i>`;
      el.addEventListener('click', () => onSkill(sk.id)); lw.appendChild(el); return el;
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
  function rebuild() { if (container && curIsle) mount(container, labelWrap, curIsle, curIsleIndex, curSkills, onSkillCb); }
  if (window.NumeraAssets) NumeraAssets.onReady(() => { if (scene) rebuild(); });
  // when a real glTF character arrives after the scene exists, swap it in
  if (window.NumeraAvatar && NumeraAvatar.onModel) NumeraAvatar.onModel(() => { if (scene && rig) placeCharacter(); });
  // small debug surface (tests + tuning)
  function worldToScreen(x, z) { if (!renderer) return null; const v = new THREE.Vector3(x, 0, z).project(camera); const r = renderer.domElement.getBoundingClientRect(); return { x: r.left + (v.x * 0.5 + 0.5) * r.width, y: r.top + (-v.y * 0.5 + 0.5) * r.height, behind: v.z > 1 }; }
  function beaconScreenPos(i) { const b = beacons[i]; if (!b || !renderer) return null; const v = b.position.clone(); v.y += 1.5; v.project(camera); const r = renderer.domElement.getBoundingClientRect(); return { x: r.left + (v.x * 0.5 + 0.5) * r.width, y: r.top + (-v.y * 0.5 + 0.5) * r.height }; }
  return { mount, stop, resume, rebuild, beaconScreenPos, worldToScreen, onFatal(cb) { fatalCb = cb; }, setCompanions(count, stars) { companions = { count, stars }; if (fx) fx.setCompanions(count, stars); }, get camera() { return { yaw: cam.yaw, pitch: cam.pitch, dist: cam.dist }; }, get walkTarget() { return walk.target ? { x: walk.target.x, z: walk.target.z, manual: !!walk.manual } : null; }, get mounts() { return mountCount; }, get playerPos() { return rig ? { x: rig.g.position.x, z: rig.g.position.z } : null; }, get ready() { ensureRenderer(); return !!renderer; } };
})();
