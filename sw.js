/* Numera service worker — app shell cached for offline play; the big character model is cached on first load. */
const VERSION = 'numera-v1';
const SHELL = ['./', './index.html', './style.css', './game.js', './avatar.js', './assets.js', './effects.js', './audio.js', './cloud.js', './island3d.js', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png',
  './vendor/three.min.js', './vendor/CopyShader.js', './vendor/LuminosityHighPassShader.js', './vendor/SSAOShader.js', './vendor/FXAAShader.js', './vendor/SimplexNoise.js', './vendor/EffectComposer.js', './vendor/RenderPass.js', './vendor/ShaderPass.js', './vendor/UnrealBloomPass.js', './vendor/SSAOPass.js', './vendor/GLTFLoader.js', './vendor/SkeletonUtils.js'];
self.addEventListener('install', e => { e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return; // cloud + fonts go straight to the network
  const isAsset = url.pathname.includes('/assets/') || url.pathname.includes('/vendor/');
  if (isAsset) { // cache-first for models and libraries
    e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request).then(r => { if (r.ok) { const copy = r.clone(); caches.open(VERSION).then(c => c.put(e.request, copy)); } return r; })));
  } else {      // network-first for the app shell, fall back to cache when offline
    e.respondWith(fetch(e.request).then(r => { if (r.ok) { const copy = r.clone(); caches.open(VERSION).then(c => c.put(e.request, copy)); } return r; }).catch(() => caches.match(e.request).then(hit => hit || caches.match('./') || caches.match('./index.html'))));
  }
});
