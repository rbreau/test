#!/usr/bin/env node
/* Bundles Numera into one self-contained HTML file: dist/numera.html
   - inlines style.css and every <script src> (vendored Three.js included)
   - disables the optional glTF asset lookup (no external fetches in a single file)
   Usage: node build.js */
const fs = require('fs'), path = require('path');
const root = __dirname;
let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
html = html.replace('<link rel="stylesheet" href="style.css">', () => '<style>\n' + fs.readFileSync(path.join(root, 'style.css'), 'utf8') + '\n</style>');
html = html.replace(/<script src="([^"]+)"><\/script>/g, (m, src) => {
  if (/^https?:/.test(src)) return m;
  return '<script>\n' + fs.readFileSync(path.join(root, src), 'utf8') + '\n</script>';
});
// single file: no asset folder, but embed the character model as a data URL when it exists and is small enough
const glbPath = path.join(root, 'assets', 'mathfinder.glb');
let charTag = 'window.NUMERA_ASSETS = null;';
if (fs.existsSync(glbPath) && fs.statSync(glbPath).size < 11 * 1024 * 1024) {
  charTag += " window.NUMERA_CHARACTER_DATA = 'data:model/gltf-binary;base64," + fs.readFileSync(glbPath).toString('base64') + "';";
  console.log('embedded character', (fs.statSync(glbPath).size / 1024 / 1024).toFixed(1) + ' MB');
}
html = html.replace(/window\.NUMERA_ASSETS = 'assets\/'; window\.NUMERA_CLOUD = \{[^}]*\};/, () => charTag + ' window.NUMERA_CLOUD = null;');
html = html.replace(/<link rel="manifest"[^>]*>\n|<link rel="icon"[^>]*>\n|<link rel="apple-touch-icon"[^>]*>\n/g, '');
// the artifact host supplies its own charset/viewport metas
html = html.replace(/^<meta charset="utf-8">\n<meta name="viewport"[^>]*>\n/, '');
fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
fs.writeFileSync(path.join(root, 'dist', 'numera.html'), html);
console.log('dist/numera.html', (html.length / 1024).toFixed(0) + ' KB');
