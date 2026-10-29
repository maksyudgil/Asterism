// Builds dist/register.html (single offline file, libraries and demo data inlined)
const fs = require('fs');
const path = require('path');
const { minify } = require('terser');
const r = p => fs.readFileSync(path.join(__dirname, p), 'utf8');
const safe = s => s.replace(/<\/(script)/gi, '<\\/$1');
const minCss = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s*\n\s*/g, '').replace(/\s*([{};,>])\s*/g, '$1').replace(/;}/g, '}');
(async () => {
  const dev = process.argv.includes('--dev');
  const mods = fs.readdirSync(path.join(__dirname, 'src/app')).filter(f => f.endsWith('.js')).sort();
  let app = "/* Asterism */\n(function () {\n'use strict';\n" + mods.map(f => `/* ---- ${f} ---- */\n` + r('src/app/' + f)).join('\n') + '\n})();\n';
  let core = r('src/core.js');
  if (!dev) {
    const m = await minify({ 'core.js': core, 'app.js': app }, { compress: { passes: 2 }, mangle: true, format: { comments: false, ascii_only: false } });
    if (m.error) throw m.error;
    core = ''; app = m.code;
  }
  fs.writeFileSync(path.join(__dirname, 'dist/app.debug.js'), r('src/core.js') + '\n' + "(function(){'use strict';\n" + mods.map(f => r('src/app/' + f)).join('\n') + '\n})();');
  const demo = r('dist/demo-files.json');
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Asterism</title>
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Ccircle cx='4' cy='4' r='2.5' fill='%237c6cf2'/%3E%3Ccircle cx='12' cy='6' r='2.5' fill='%239a8cff'/%3E%3Ccircle cx='6' cy='12' r='2.5' fill='%2306b6d4'/%3E%3Cpath d='M4 4L12 6L6 12Z' stroke='%23aaa' fill='none'/%3E%3C/svg%3E">
<style>${dev ? r('src/app.css') : minCss(r('src/app.css'))}</style>
</head><body>
<div id="app"></div>
<script>/* js-yaml (MIT) */\n${safe(r('node_modules/js-yaml/dist/browser/js-yaml.umd.min.js'))}</script>
<script>/* marked (MIT) */\n${safe(r('node_modules/marked/marked.min.js'))}</script>
<script>/* force-graph (MIT) */\n${safe(r('node_modules/force-graph/dist/force-graph.min.js'))}</script>
<script>window.DEMO_FILES = ${safe(demo)};</script>
${core ? `<script>${safe(core)}</script>\n` : ''}<script>${safe(app)}</script>
</body></html>`;
  fs.writeFileSync(path.join(__dirname, 'register.html'), html);
  console.log('register.html', (html.length / 1024).toFixed(0), 'KB', dev ? '(dev)' : '');
})().catch(e => { console.error(e); process.exit(1); });
