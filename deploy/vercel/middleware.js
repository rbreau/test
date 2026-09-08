/* Numera gate — Vercel Edge Middleware.
   Every request needs a cookie proving the visitor entered the passcode.
   Without it, nothing about the game (HTML, scripts, keys) is served.
   Set NUMERA_PASSCODE in the Vercel project's environment variables to
   change the passcode; NUMERA_PASS_HASH is the fallback baked in at deploy. */
export const config = { matcher: ['/((?!icons/|manifest\\.webmanifest|_vercel).*)'] };

const COOKIE = 'numera_gate';
const PASS_HASH_FALLBACK = '__PASS_HASH__';
const YEAR = 60 * 60 * 24 * 365;

async function sha(s) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}
async function expected() {
  const pass = (typeof process !== 'undefined' && process.env && process.env.NUMERA_PASSCODE) || '';
  return pass ? sha('numera|' + pass) : PASS_HASH_FALLBACK;
}
function page(err) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Numera</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0a0e23;color:#ede6d3;font-family:system-ui,sans-serif;text-align:center}
form{background:#121936;border:1px solid #2b3565;border-radius:16px;padding:32px 28px;width:min(90vw,360px)}h1{font-family:Georgia,serif;letter-spacing:.14em;color:#f2c14e;margin:0 0 4px;font-size:28px}
p{color:#93a5c4;font-size:14px;margin:0 0 18px}input{width:100%;box-sizing:border-box;background:#0a0e23;border:1px solid #2b3565;border-radius:10px;color:#ede6d3;font-size:18px;padding:12px 14px;text-align:center;letter-spacing:.04em}
button{margin-top:12px;width:100%;background:#f2c14e;color:#0a0e23;border:none;border-radius:10px;font-weight:700;font-size:16px;padding:12px}.err{color:#f26b8a;font-size:13px;margin-top:10px}</style></head>
<body><form method="post" action="/__unlock"><div style="font-size:26px;color:#f2c14e">✦</div><h1>NUMERA</h1><p>This isle is private. Enter the passcode.</p>
<input name="key" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="passcode" autofocus><button>Enter</button>${err ? '<div class="err">That is not the passcode.</div>' : ''}</form></body></html>`;
}
const html = (body, status, extra) => new Response(body, { status, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', ...(extra || {}) } });

export default async function middleware(req) {
  const url = new URL(req.url);
  const want = await expected();
  const cookies = req.headers.get('cookie') || '';
  const has = cookies.split(/;\s*/).some(c => c === `${COOKIE}=${want}`);
  const setCookie = `${COOKIE}=${want}; Path=/; Max-Age=${YEAR}; HttpOnly; Secure; SameSite=Lax`;

  // passcode submitted through the form
  if (url.pathname === '/__unlock' && req.method === 'POST') {
    const form = await req.formData().catch(() => null);
    const key = form ? String(form.get('key') || '') : '';
    if (key && await sha('numera|' + key.trim()) === want) return new Response(null, { status: 303, headers: { location: '/', 'set-cookie': setCookie, 'cache-control': 'no-store' } });
    return html(page(true), 401);
  }
  // passcode in the address: numera.vercel.app/?key=... (handy on a phone), then scrub it from the URL
  const qk = url.searchParams.get('key');
  if (qk && await sha('numera|' + qk.trim()) === want) {
    url.searchParams.delete('key');
    return new Response(null, { status: 303, headers: { location: url.pathname + (url.search || ''), 'set-cookie': setCookie, 'cache-control': 'no-store' } });
  }
  if (has) return new Response(null, { headers: { 'x-middleware-next': '1' } });   // let the request through to the static files
  return html(page(false), 401);
}
