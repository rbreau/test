/* Vercel build: fetch the game source straight from GitHub at a pinned commit,
   then stage only the runtime files into ./out. Keeps the deploy payload tiny
   and lets the 8 MB character model be served from Vercel's CDN. */
const { execSync } = require('child_process');
const fs = require('fs'), path = require('path');
const REPO = process.env.NUMERA_REPO || 'rbreau/test';
const REF = process.env.NUMERA_REF || 'claude/math-learning-game-cbmo8j';
const url = `https://codeload.github.com/${REPO}/tar.gz/${REF}`;
fs.rmSync('src', { recursive: true, force: true }); fs.rmSync('out', { recursive: true, force: true });
fs.mkdirSync('src');
console.log('fetching', url);
execSync(`curl -fsSL "${url}" | tar xz -C src --strip-components=1`, { stdio: 'inherit' });
const SKIP = new Set(['unity', 'dist', 'tools', 'docs', 'deploy', '.github', 'build.js', 'README.md', '.nojekyll', '.gitignore', 'vercel.json', 'package.json']);
fs.mkdirSync('out');
for (const name of fs.readdirSync('src')) {
  if (SKIP.has(name)) continue;
  const from = path.join('src', name);
  const st = fs.lstatSync(from);
  if (st.isSymbolicLink()) { console.log('skipping symlink', name); continue; } // e.g. dev-only links
  fs.cpSync(from, path.join('out', name), { recursive: true, dereference: false, filter: p => !fs.lstatSync(p).isSymbolicLink() });
}
const list = execSync('find out -type f | sort').toString().trim().split('\n');
console.log(list.length, 'files staged'); console.log(list.join('\n'));
