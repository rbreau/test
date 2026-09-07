'use strict';
/* ================================================================
   NUMERA — asset pipeline
   Reads <NUMERA_ASSETS>/manifest.json, preloads every glTF it names,
   normalizes each model (feet on the ground, height to a per-kind
   target), re-shades it with a stepped toon ramp so mixed packs read
   as one world, and hands out clones on demand. Anything missing
   falls back to the procedural placeholders in island3d.js.
   ================================================================ */
window.NumeraAssets = (function () {
  const HEIGHTS = { tree: 2.3, bush: 0.7, rock: 0.55, house: 1.7, lamp: 2.1, prop: 0.9, beacon: 3.2, landmark: 3.6, flower: 0.25 };
  let manifest = null, base = '', ready = false, pending = 0;
  const templates = {}; // kind -> [Object3D]
  const landmarks = {}; // isleId -> Object3D
  const listeners = [];
  let ramp = null;

  function toonRamp() {
    if (ramp) return ramp;
    const c = document.createElement('canvas'); c.width = 4; c.height = 1;
    const x = c.getContext('2d');
    [[0, '#6f7fb8'], [1, '#a9b3d6'], [2, '#e2e6f2'], [3, '#ffffff']].forEach(([i, col]) => { x.fillStyle = col; x.fillRect(i, 0, 1, 1); });
    ramp = new THREE.CanvasTexture(c); ramp.minFilter = ramp.magFilter = THREE.NearestFilter; ramp.generateMipmaps = false;
    return ramp;
  }
  /* Re-shade a loaded model: keep albedo texture + color, swap to a toon material. */
  function stylize(root) {
    root.traverse(o => {
      if (!o.isMesh) return;
      o.castShadow = true; o.receiveShadow = true;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      const out = mats.map(m => {
        if (!m) return m;
        if (manifest && manifest.style === 'keep') return m;
        const t = new THREE.MeshToonMaterial({ color: m.color ? m.color.clone() : new THREE.Color(0xffffff), map: m.map || null, gradientMap: toonRamp(), transparent: !!m.transparent, opacity: m.opacity === undefined ? 1 : m.opacity, side: m.side || THREE.FrontSide });
        if (m.emissive) { t.emissive = m.emissive.clone(); t.emissiveIntensity = m.emissiveIntensity || 1; t.emissiveMap = m.emissiveMap || null; }
        if (m.map) m.map.encoding = THREE.sRGBEncoding;
        t.vertexColors = !!m.vertexColors;
        return t;
      });
      o.material = Array.isArray(o.material) ? out : out[0];
    });
  }
  /* Ground the model and scale it to the kind's target height. */
  function normalize(root, kind) {
    const box = new THREE.Box3().setFromObject(root);
    const size = box.getSize(new THREE.Vector3());
    const target = (manifest && manifest.heights && manifest.heights[kind]) || HEIGHTS[kind] || 1;
    const s = size.y > 1e-6 ? target / size.y : 1;
    const wrap = new THREE.Group();
    root.scale.setScalar(s);
    root.position.set(-(box.min.x + size.x / 2) * s, -box.min.y * s, -(box.min.z + size.z / 2) * s);
    wrap.add(root);
    return wrap;
  }
  function loadOne(url, kind, onDone) {
    pending++;
    new THREE.GLTFLoader().load(base + url, g => {
      stylize(g.scene);
      onDone(normalize(g.scene, kind));
      if (--pending === 0) fire();
    }, undefined, err => { console.warn('Numera asset missing:', url); if (--pending === 0) fire(); });
  }
  function fire() { ready = true; listeners.forEach(cb => { try { cb(); } catch (e) { console.error(e); } }); }

  function init(assetBase) {
    if (!assetBase || !window.THREE || !THREE.GLTFLoader) return;
    base = assetBase;
    fetch(base + 'manifest.json').then(r => r.ok ? r.json() : null).then(m => {
      if (!m) return;
      manifest = m;
      const kit = m.kit || {};
      Object.keys(kit).forEach(kind => {
        const list = Array.isArray(kit[kind]) ? kit[kind] : [kit[kind]];
        templates[kind] = [];
        list.forEach(url => loadOne(url, kind, obj => templates[kind].push(obj)));
      });
      Object.keys(m.landmarks || {}).forEach(id => loadOne(m.landmarks[id], 'landmark', obj => { landmarks[id] = obj; }));
      if (m.character && window.NumeraAvatar) NumeraAvatar.loadModel(base + m.character);
      if (pending === 0) fire();
    }).catch(() => { /* no manifest — procedural world */ });
  }
  /* A fresh clone of the i-th template of a kind (wraps around), or null. */
  function get(kind, i) {
    const list = templates[kind];
    if (!list || !list.length) return null;
    return list[((i || 0) % list.length + list.length) % list.length].clone(true);
  }
  function landmark(isleId) { return landmarks[isleId] ? landmarks[isleId].clone(true) : null; }
  function onReady(cb) { listeners.push(cb); if (ready) cb(); }
  const has = kind => !!(templates[kind] && templates[kind].length);
  const toon = () => !manifest || manifest.style !== 'keep';

  if (window.NUMERA_ASSETS) init(window.NUMERA_ASSETS);
  return { init, get, landmark, onReady, has, toon, toonRamp, get ready() { return ready; }, get manifest() { return manifest; } };
})();
