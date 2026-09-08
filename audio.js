'use strict';
/* ================================================================
   NUMERA — synthesized soundscape (Web Audio, no files)
   Ambient wind and waves that follow the time of day, footsteps,
   tap chimes, answer feedback, a level-up fanfare, and a soft hum
   that rises as you approach a beacon. Starts on the first gesture.
   ================================================================ */
window.NumeraAudio = (function () {
  let ctx = null, master = null, muted = false, wind = null, waves = null, hum = null, humGain = null, started = false;
  const now = () => ctx.currentTime;

  function noiseBuffer(seconds) {
    const len = Math.floor(ctx.sampleRate * seconds), buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    let last = 0; for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } // brown-ish noise
    return buf;
  }
  function ensure() {
    if (ctx) return true;
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return false; }
    master = ctx.createGain(); master.gain.value = muted ? 0 : 0.9; master.connect(ctx.destination);
    // wind: brown noise → lowpass, slow LFO on gain
    const nb = noiseBuffer(3);
    const src = ctx.createBufferSource(); src.buffer = nb; src.loop = true;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 380; lp.Q.value = 0.7;
    wind = ctx.createGain(); wind.gain.value = 0.05;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.11; const lfoG = ctx.createGain(); lfoG.gain.value = 0.03; lfo.connect(lfoG); lfoG.connect(wind.gain);
    src.connect(lp); lp.connect(wind); wind.connect(master); src.start(); lfo.start();
    // waves: same noise → bandpass with a slow swell
    const src2 = ctx.createBufferSource(); src2.buffer = nb; src2.loop = true; src2.playbackRate.value = 0.7;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 220; bp.Q.value = 1.2;
    waves = ctx.createGain(); waves.gain.value = 0.04;
    const lfo2 = ctx.createOscillator(); lfo2.frequency.value = 0.08; const lfo2G = ctx.createGain(); lfo2G.gain.value = 0.035; lfo2.connect(lfo2G); lfo2G.connect(waves.gain);
    src2.connect(bp); bp.connect(waves); waves.connect(master); src2.start(); lfo2.start();
    // beacon hum
    hum = ctx.createOscillator(); hum.type = 'sine'; hum.frequency.value = 110;
    const hum2 = ctx.createOscillator(); hum2.type = 'sine'; hum2.frequency.value = 165.2;
    humGain = ctx.createGain(); humGain.gain.value = 0;
    hum.connect(humGain); hum2.connect(humGain); humGain.connect(master); hum.start(); hum2.start();
    started = true;
    return true;
  }
  function unlock() { if (ensure() && ctx.state === 'suspended') ctx.resume(); }
  ['pointerdown', 'keydown', 'touchstart'].forEach(ev => addEventListener(ev, unlock, { passive: true }));

  function tone(freq, dur, type, gain, when, slideTo) {
    if (!ctx || muted) return;
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type || 'sine'; o.frequency.value = freq;
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, now() + when + dur);
    g.gain.setValueAtTime(0.0001, now() + when); g.gain.exponentialRampToValueAtTime(gain, now() + when + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, now() + when + dur);
    o.connect(g); g.connect(master); o.start(now() + when); o.stop(now() + when + dur + 0.05);
  }
  function burst(dur, freq, gain) {
    if (!ctx || muted) return;
    const src = ctx.createBufferSource(); src.buffer = noiseBuffer(0.2);
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 0.9;
    const g = ctx.createGain(); g.gain.setValueAtTime(gain, now()); g.gain.exponentialRampToValueAtTime(0.0001, now() + dur);
    src.connect(f); f.connect(g); g.connect(master); src.start(); src.stop(now() + dur + 0.02);
  }

  return {
    get muted() { return muted; },
    setMuted(m) { muted = m; if (master) master.gain.setTargetAtTime(m ? 0 : 0.9, ctx.currentTime, 0.05); },
    setDaylight(day) { if (!ctx) return; wind.gain.setTargetAtTime(0.035 + 0.03 * (1 - day), now(), 0.5); waves.gain.setTargetAtTime(0.03 + 0.02 * day, now(), 0.5); },
    beaconProximity(v) { if (!ctx) return; humGain.gain.setTargetAtTime(muted ? 0 : Math.max(0, Math.min(1, v)) * 0.035, now(), 0.15); },
    step() { burst(0.07, 700 + Math.random() * 300, 0.18); },
    tap() { tone(880, 0.14, 'sine', 0.12, 0, 1320); },
    pop() { burst(0.12, 1800, 0.35); tone(720, 0.07, 'square', 0.06, 0, 160); },
    correct(combo) { tone(659, 0.16, 'triangle', 0.16, 0); tone(784, 0.22, 'triangle', 0.16, 0.09); if (combo >= 5) tone(1046, 0.3, 'triangle', 0.14, 0.18); },
    wrong() { tone(196, 0.28, 'sine', 0.14, 0, 130); },
    starfall() { [1568, 1976, 2637].forEach((f, i) => tone(f, 0.25, 'sine', 0.08, i * 0.06)); },
    levelUp() { [523, 659, 784, 1046, 1318].forEach((f, i) => { tone(f, 0.5, 'triangle', 0.16, i * 0.11); tone(f * 2, 0.35, 'sine', 0.05, i * 0.11); }); },
    catchNumen() { [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.4, 'sine', 0.12, i * 0.13)); },
  };
})();
