'use strict';
/* ================================================================
   NUMERA — cloud saves
   Progress syncs to Supabase through two SECURITY DEFINER functions
   (get_save / put_save) keyed by a secret link code the player owns.
   No email, no passwords: the code IS the account. Type it on another
   device and your isles follow you. Local storage stays the cache.
   ================================================================ */
window.NumeraCloud = (function () {
  const CFG = window.NUMERA_CLOUD || null;           // { url, key } injected by index.html / build
  const WORDS = ['ember', 'tide', 'reef', 'glass', 'ratio', 'peak', 'vale', 'grove', 'falls', 'temple', 'mire', 'caldera', 'lantern', 'numen', 'starlight', 'lumin', 'crown', 'echo', 'sigil', 'isle', 'compass', 'comet', 'shard', 'coral', 'moss', 'dune', 'fern', 'opal', 'quill', 'rune'];
  let code = null, pushTimer = null, status = 'off', lastError = '';
  const listeners = [];
  const enabled = () => !!(CFG && CFG.url && CFG.key);

  function genCode() { const w = () => WORDS[Math.floor(Math.random() * WORDS.length)]; return `${w()}-${w()}-${w()}-${Math.floor(1000 + Math.random() * 9000)}`; }
  function loadCode() { try { code = localStorage.getItem('numera-cloud-code') || null; } catch (e) { code = null; } return code; }
  function setCode(c) { code = c ? c.trim().toLowerCase() : null; try { if (code) localStorage.setItem('numera-cloud-code', code); else localStorage.removeItem('numera-cloud-code'); } catch (e) { } emit(); }
  function emit() { listeners.forEach(cb => { try { cb(status, code); } catch (e) { } }); }
  function setStatus(s, err) { status = s; lastError = err || ''; emit(); }

  async function rpc(fn, body) {
    const r = await fetch(`${CFG.url}/rest/v1/rpc/${fn}`, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: CFG.key, Authorization: 'Bearer ' + CFG.key }, body: JSON.stringify(body) });
    if (!r.ok) throw new Error(`${fn} ${r.status}: ${(await r.text()).slice(0, 140)}`);
    const t = await r.text(); return t ? JSON.parse(t) : null;
  }
  /* Pull the remote save for the current code. Returns the state object or null. */
  async function pull() {
    if (!enabled() || !code) return null;
    setStatus('syncing');
    try { const row = await rpc('get_save', { p_code: code }); setStatus('ok'); return row && row.data ? row.data : null; }
    catch (e) { setStatus('error', e.message); return null; }
  }
  /* Push a state object (debounced) */
  function push(state) {
    if (!enabled() || !code) return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(async () => {
      setStatus('syncing');
      try { await rpc('put_save', { p_code: code, p_data: state }); setStatus('ok'); }
      catch (e) { setStatus('error', e.message); }
    }, 1200);
  }
  /* Merge rule: whichever save has more progress wins (solved count, then xp), ties → newer. */
  function pick(local, remote) {
    if (!remote) return local; if (!local) return remote;
    const score = s => ((s.stats && s.stats.solved) || 0) * 1000 + (s.level || 0) * 100 + (s.xp || 0);
    if (score(remote) !== score(local)) return score(remote) > score(local) ? remote : local;
    return (remote.savedAt || 0) >= (local.savedAt || 0) ? remote : local;
  }
  loadCode();
  return { enabled, genCode, setCode, pull, push, pick, onChange(cb) { listeners.push(cb); }, get code() { return code; }, get status() { return status; }, get lastError() { return lastError; } };
})();
