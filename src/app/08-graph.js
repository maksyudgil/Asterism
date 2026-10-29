/* ================= graph ================= */
function hexA(hex, a) { const h = hex.replace('#', ''); const f = h.length === 3 ? h.split('').map(c => c + c).join('') : h; const n = parseInt(f.slice(0, 6), 16); return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`; }
function groupKey(o) {
  const g = state.graph;
  if (g.colorBy === 'template') return o.template;
  if (g.colorBy === 'top') return folderSegs(o.folder)[0] || '(root)';
  if (g.colorBy === 'folder') return o.folder || '(root)';
  if (g.colorBy === 'tag') return o.tags[0] || '(no tag)';
  return '';
}
let groupColors = new Map();
function computeGroupColors(nodes) {
  groupColors = new Map(); const g = state.graph;
  if (g.colorBy === 'single') return;
  const keys = [...new Set(nodes.filter(n => n.o).map(n => groupKey(n.o)))].sort();
  keys.forEach((k, i) => groupColors.set(k, g.colorBy === 'template' ? (state.templates[k]?.color || '#8b8d98') : (k.startsWith('(') ? '#6b6b7d' : PALETTE[i % PALETTE.length])));
}
const nodeColor = o => state.graph.colorBy === 'single' ? '#b4b4c8' : (groupColors.get(groupKey(o)) || '#8b8d98');
const lid = x => (x && typeof x === 'object') ? x.id : x;
const nodeR = n => { const s = state.graph.nodeStyle;
  if (n.kind) { const c = Math.sqrt(n.count || 1); return (n.kind === 'root' ? 9 : 6) + c * (s === 'glow' ? .75 : 1); }
  const d = Math.sqrt(n.deg || 0); return s === 'icons' ? 7 + d * 1.6 : s === 'glow' ? 3.4 + d * 1.5 : 4 + d * 1.8; };
const nColor = n => n.kind ? n.fcolor : nodeColor(n.o);
const nIcon = n => n.kind ? n.icon : iconOf(n.o);
const nName = n => n.kind ? `${n.name} (${n.count})` : n.o.name;
function mixHex(a, b, t) { const p = h => { h = h.replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join(''); const n = parseInt(h.slice(0, 6), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }; const x = p(a), y = p(b); return `rgb(${x.map((v, i) => Math.round(v + (y[i] - v) * t)).join(',')})`; }
const GRAPH_BG = () => state.graph.nodeStyle === 'glow' ? '#05050b' : 'rgba(0,0,0,0)';

function graphData() {
  const g = state.graph, visibleRel = t => !g.hidden.has(t);
  let ids;
  if (g.local && state.objects.has(state.selectedId)) {
    ids = new Set([state.selectedId]); let frontier = [state.selectedId];
    for (let d = 0; d < g.depth; d++) {
      const next = [];
      for (const id of frontier) {
        for (const r of state.objects.get(id).relations) if (visibleRel(r.type) && state.objects.has(r.target) && !ids.has(r.target)) { ids.add(r.target); next.push(r.target); }
        for (const r of state.inbound.get(id) || []) if (visibleRel(r.type) && !ids.has(r.from)) { ids.add(r.from); next.push(r.from); }
      }
      frontier = next;
    }
  } else ids = new Set(filteredObjects().map(o => o.id));
  if (g.hidePeople) for (const id of [...ids]) if (id !== state.selectedId && state.objects.get(id)?.template === 'person') ids.delete(id);
  const links = [];
  for (const id of ids) for (const r of state.objects.get(id).relations) if (ids.has(r.target) && visibleRel(r.type)) links.push({ source: id, target: r.target, type: r.type });
  const deg = new Map(); links.forEach(l => { deg.set(l.source, (deg.get(l.source) || 0) + 1); deg.set(l.target, (deg.get(l.target) || 0) + 1); });
  if (g.hideOrphans) for (const id of [...ids]) if (!deg.get(id) && id !== state.selectedId) ids.delete(id);
  const pair = new Map();
  links.forEach(l => { const k = [l.source, l.target].sort().join('|'); const n = pair.get(k) || 0; pair.set(k, n + 1); l.curv = n === 0 ? 0 : (n % 2 ? 1 : -1) * 0.25 * Math.ceil(n / 2) * (l.source < l.target ? 1 : -1); });
  const nodes = [...ids].map(id => { let n = gNodeCache.get(id); if (!n) { n = { id }; gNodeCache.set(id, n); } n.kind = ''; n.o = state.objects.get(id); n.deg = deg.get(id) || 0; return n; });
  computeGroupColors(nodes);
  return { nodes, links };
}
/* structure view: register → folders → sub-folders → objects; collapsed folders carry their objects' links */
function treeData() {
  const g = state.graph, visibleRel = t => !g.hidden.has(t);
  const rootPath = state.filter.kind === 'folder' ? state.filter.value : '';
  if (!g.expanded || g.expandedRoot !== rootPath) { g.expanded = new Set([rootPath]); g.expandedRoot = rootPath; }
  const inSub = (o, f) => !f || o.folder === f || o.folder.startsWith(f + '/');
  const objs = [...state.objects.values()].filter(o => inSub(o, rootPath) && !(g.hidePeople && o.template === 'person'));
  const nodes = [], links = [], rep = new Map();
  const node = (id, init, parent) => {
    let n = gNodeCache.get(id); if (!n) { n = { id }; gNodeCache.set(id, n); }
    if (n.x == null && parent && parent.x != null) { n.x = parent.x + (Math.random() - .5) * 30; n.y = parent.y + (Math.random() - .5) * 30; }
    Object.assign(n, init); nodes.push(n); return n;
  };
  const visit = (path, parent, depth) => {
    const sub = objs.filter(o => inSub(o, path));
    if (!sub.length && path !== rootPath) return;
    const byT = groupBy(sub, o => o.template); let dom = null, best = 0; for (const [k, l] of byT) if (l.length > best) { best = l.length; dom = k; }
    const domT = dom && best / sub.length >= .6 ? state.templates[dom] : null;
    const n = node('f:' + path, { kind: path === rootPath ? 'root' : 'folder', path, name: path ? path.split('/').at(-1) : 'Asterism', count: sub.length, depth,
      icon: path === rootPath ? '🗂️' : (domT?.icon || '📁'), fcolor: path === rootPath ? '#e8e6ff' : (domT?.color || '#9aa0c8'), open: g.expanded.has(path), o: null, deg: 0 }, parent);
    if (parent) links.push({ source: parent.id, target: n.id, kind: 'contains' });
    if (!g.expanded.has(path)) { sub.forEach(o => rep.set(o.id, n.id)); return; }
    [...state.folders.keys()].filter(k => k && k.split('/').slice(0, -1).join('/') === path).sort().forEach(k => visit(k, n, depth + 1));
    objs.filter(o => o.folder === path).forEach(o => { const c = node(o.id, { kind: '', o, deg: 0 }, n); links.push({ source: n.id, target: c.id, kind: 'contains' }); rep.set(o.id, o.id); });
  };
  visit(rootPath, null, 0);
  const agg = new Map(), objLinks = [];
  for (const o of objs) for (const r of o.relations) {
    if (!visibleRel(r.type) || !rep.has(r.target)) continue;
    const a = rep.get(o.id), b = rep.get(r.target); if (a === b) continue;
    if (!a.startsWith('f:') && !b.startsWith('f:')) { objLinks.push({ source: a, target: b, type: r.type }); continue; }
    const k = [a, b].sort().join('|'); let l = agg.get(k);
    if (!l) { l = { source: a, target: b, kind: 'agg', count: 0, types: {} }; agg.set(k, l); }
    l.count++; l.types[r.type] = (l.types[r.type] || 0) + 1;
  }
  for (const l of agg.values()) l.type = Object.entries(l.types).sort((x, y) => y[1] - x[1])[0][0];
  const pair = new Map();
  objLinks.forEach(l => { const k = [l.source, l.target].sort().join('|'); const n = pair.get(k) || 0; pair.set(k, n + 1); l.curv = n === 0 ? 0 : (n % 2 ? 1 : -1) * 0.25 * Math.ceil(n / 2) * (l.source < l.target ? 1 : -1); });
  const all = [...links, ...agg.values(), ...objLinks];
  const deg = new Map(); objLinks.forEach(l => { deg.set(l.source, (deg.get(l.source) || 0) + 1); deg.set(l.target, (deg.get(l.target) || 0) + 1); });
  nodes.forEach(n => { if (!n.kind) n.deg = deg.get(n.id) || 0; });
  computeGroupColors(nodes);
  return { nodes, links: all };
}
function toggleFolder(path) {
  const g = state.graph;
  if (g.expanded.has(path)) { for (const p of [...g.expanded]) if (p === path || (path === '' ? p !== '' : p.startsWith(path + '/'))) g.expanded.delete(p); }
  else g.expanded.add(path);
  updateGraph();
}
let gAdj = new Map();
let hlSet = null, hlId = null;
function setHighlight() {
  const g = state.graph, id = gHover?.id || (g.infoOpen && g.selFolder == null ? state.selectedId : null);
  hlId = id; hlSet = id ? new Set([id, ...(gAdj.get(id) || [])]) : null;
  redraw();
}

function renderGraphView() {
  destroyGraph();
  const g = state.graph;
  const relCounts = {}; for (const o of state.objects.values()) for (const r of o.relations) relCounts[r.type] = (relCounts[r.type] || 0) + 1;
  const relKeys = [...new Set([...Object.keys(state.relTypes), ...Object.keys(relCounts)])];
  const sel = state.objects.get(state.selectedId);
  const opt = (list, cur) => list.map(([v, l]) => `<option value="${v}" ${cur === v ? 'selected' : ''}>${l}</option>`).join('');
  $('#main').innerHTML = `<section class="gwrap ${g.nodeStyle === 'glow' ? 'space' : ''}"><div id="graph"></div>
    <div class="gpanel ${g.panelMin ? 'min' : ''}" id="gpanel"><button class="ghost sm collapse" data-act="g-panel">${g.panelMin ? '☰ Graph settings' : '–'}</button>
      <h4>View</h4><div class="seg" style="width:100%"><button class="${g.mode === 'net' ? 'on' : ''}" data-act="g-mode" data-v="net" style="flex:1">🕸 Network</button><button class="${g.mode === 'tree' ? 'on' : ''}" data-act="g-mode" data-v="tree" style="flex:1">🗂️ Structure</button></div>
      ${g.mode === 'tree' ? `<p class="note" style="margin:6px 0 0">Click a folder to open or close it. Dashed lines join folders whose objects are linked (×N links). Starts from the folder selected in the sidebar.</p>
        <div style="display:flex;gap:6px;margin-top:6px"><button class="sm" data-act="g-expand-all">Open all</button><button class="sm" data-act="g-collapse-all">Close all</button></div>` : ''}
      <h4>Find</h4><button class="pickbtn" data-act="g-find" style="width:100%"><span class="dim">🔍 Find object…</span></button>
      <div ${g.mode === 'tree' ? 'style="display:none"' : ''}><h4>Scope</h4><div class="gl">
        <label class="chk"><input type="radio" name="gscope" value="global" ${!g.local ? 'checked' : ''}> All (sidebar filter + search)</label>
        <label class="chk"><input type="radio" name="gscope" value="local" ${g.local ? 'checked' : ''} ${sel ? '' : 'disabled'}> Around ${sel ? `<b>${esc(sel.name)}</b>` : 'selected object'}</label>
        <label class="chk" style="padding-left:22px">depth <input type="range" id="gdepth" min="1" max="5" value="${g.depth}" style="width:90px"> <span id="gdv">${g.depth}</span></label></div></div>
      <h4>Nodes</h4><div class="gl">
        <select id="gstyle">${opt([['glow', '✨ Glowing stars'], ['icons', '🛡️ Icons'], ['dots', '● Dots']], g.nodeStyle)}</select>
        <select id="gcolor">${opt([['single', 'One colour'], ['template', 'Colour by type'], ['top', 'Colour by top folder'], ['folder', 'Colour by folder'], ['tag', 'Colour by first tag']], g.colorBy)}</select></div>
      <h4>Display</h4><div class="gl">
        <label class="chk">Labels <select id="glabels" style="width:auto;padding:2px 6px;margin-left:6px">${opt([['auto', 'when zoomed'], ['always', 'always'], ['off', 'off']], g.labels)}</select></label>
        <label class="chk"><input type="checkbox" id="garrows" ${g.arrows ? 'checked' : ''}> Arrows (direction)</label>
        <label class="chk"><input type="checkbox" id="glcolor" ${g.linkColor ? 'checked' : ''}> Colour links by type</label>
        <label class="chk"><input type="checkbox" id="gllabels" ${g.linkLabels ? 'checked' : ''}> Relation names on links</label>
        <label class="chk"><input type="checkbox" id="gorph" ${g.hideOrphans ? 'checked' : ''}> Hide objects without links</label>
        <label class="chk" title="Owners link to almost everything and pull the graph into a star"><input type="checkbox" id="gpeople" ${g.hidePeople ? 'checked' : ''}> Hide people</label></div>
      <h4>Relations <span style="float:right;text-transform:none;letter-spacing:0"><a data-act="g-relall" style="cursor:pointer">all</a> · <a data-act="g-relnone" style="cursor:pointer">none</a></span></h4>
      <div class="relf">${relKeys.map(k => `<label><input type="checkbox" data-grel="${esc(k)}" ${g.hidden.has(k) ? '' : 'checked'}><span class="dot" style="--c:${esc(relOf(k).color)}"></span>${esc(relOf(k).label)}<span class="n">${relCounts[k] || 0}</span></label>`).join('')}</div>
      <div style="margin-top:12px;display:flex;gap:6px;flex-wrap:wrap"><button class="sm" data-act="g-fit">Fit to screen</button><button class="sm" data-act="g-reheat">Re-layout</button><button class="sm" data-act="g-png">Save image</button></div>
    </div>
    <div class="legend" id="glegend"></div><div class="ginfo hidden" id="ginfo"></div><div class="gstat" id="gstat"></div></section>`;
  bindGraphPanel();
  buildGraph();
}
function saveGraphPrefs() { const g = state.graph; prefs.graph = { nodeStyle: g.nodeStyle, colorBy: g.colorBy, labels: g.labels, arrows: g.arrows, linkColor: g.linkColor, linkLabels: g.linkLabels, mode: g.mode, hideOrphans: g.hideOrphans, hidePeople: g.hidePeople, depth: g.depth, hidden: [...g.hidden], panelMin: g.panelMin }; savePrefs(); }
function bindGraphPanel() {
  const g = state.graph, p = $('#gpanel');
  p.addEventListener('change', e => {
    const t = e.target;
    if (t.name === 'gscope') { g.local = t.value === 'local'; updateGraph(true); }
    else if (t.id === 'gstyle') { g.nodeStyle = t.value; $('.gwrap').classList.toggle('space', g.nodeStyle === 'glow'); if (FG) { FG.backgroundColor(GRAPH_BG()); FG.nodeVal(n => nodeR(n) ** 2); applyForces(); FG.d3ReheatSimulation(); } }
    else if (t.id === 'gcolor') { g.colorBy = t.value; updateGraph(); }
    else if (t.id === 'glabels') g.labels = t.value;
    else if (t.id === 'garrows') { g.arrows = t.checked; FG && FG.linkDirectionalArrowLength(g.arrows ? 4 : 0); }
    else if (t.id === 'glcolor') g.linkColor = t.checked;
    else if (t.id === 'gllabels') g.linkLabels = t.checked;
    else if (t.id === 'gorph') { g.hideOrphans = t.checked; updateGraph(); }
    else if (t.id === 'gpeople') { g.hidePeople = t.checked; updateGraph(true); }
    else if (t.dataset.grel) { t.checked ? g.hidden.delete(t.dataset.grel) : g.hidden.add(t.dataset.grel); updateGraph(); }
    saveGraphPrefs(); redraw();
  });
  $('#gdepth').addEventListener('input', e => { g.depth = +e.target.value; $('#gdv').textContent = g.depth; if (g.local) updateGraph(true); saveGraphPrefs(); });
}
/* pre-rendered sprites: drawing a cached image is far cheaper than building gradients / emoji every frame */
const spriteCache = new Map();
function orbSprite(col) {
  let c = spriteCache.get('o' + col); if (c) return c;
  c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,.95)'); g.addColorStop(.12, mixHex(col, '#ffffff', .6).replace('rgb', 'rgba').replace(')', ',.95)'));
  g.addColorStop(.3, hexA(col, .75)); g.addColorStop(.55, hexA(col, .3)); g.addColorStop(.8, hexA(col, .08)); g.addColorStop(1, hexA(col, 0));
  x.fillStyle = g; x.fillRect(0, 0, 128, 128); spriteCache.set('o' + col, c); return c;
}
function emojiSprite(icon) {
  let c = spriteCache.get('e' + icon); if (c) return c;
  c = document.createElement('canvas'); c.width = c.height = 96; const x = c.getContext('2d');
  x.font = '68px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(icon, 48, 52);
  spriteCache.set('e' + icon, c); return c;
}
let starTile = null;
function starsTile() {
  if (starTile) return starTile;
  const S = 512, c = document.createElement('canvas'); c.width = c.height = S; const x = c.getContext('2d'); let s = 7;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  x.fillStyle = '#dfe4ff';
  for (let i = 0; i < 90; i++) { x.globalAlpha = rnd() * .45 + .1; x.beginPath(); x.arc(rnd() * S, rnd() * S, rnd() * 1.1 + .3, 0, 2 * Math.PI); x.fill(); }
  return starTile = c;
}
let redrawRaf = 0;
/* the graph only repaints when something changes; ask for one repaint after a state change */
function redraw() { if (!FG) return; FG.autoPauseRedraw(false); cancelAnimationFrame(redrawRaf); redrawRaf = requestAnimationFrame(() => requestAnimationFrame(() => FG && FG.autoPauseRedraw(true))); }
function drawNode(n, ctx, scale) {
  if (!Number.isFinite(n.x) || !Number.isFinite(n.y)) return;
  const g = state.graph, r = nodeR(n), dim = hlSet && !hlSet.has(n.id);
  const sel = g.infoOpen && (n.kind ? g.selFolder === n.path : n.id === state.selectedId), hot = sel || n.id === hlId;
  const col = nColor(n);
  ctx.globalAlpha = dim ? .13 : 1;
  if (g.nodeStyle === 'glow') {
    // soft orb: bright centre, colour fading to fully transparent at the rim
    const R = r * (n.kind ? (hot ? 2.4 : 2.1) : (hot ? 3.1 : 2.6));
    ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(orbSprite(col), n.x - R, n.y - R, 2 * R, 2 * R);
    ctx.globalCompositeOperation = 'source-over';
    if (n.kind) { ctx.lineWidth = 1 / scale; ctx.strokeStyle = hexA(col, .45); ctx.setLineDash(n.open ? [] : [3 / scale, 3 / scale]); ctx.beginPath(); ctx.arc(n.x, n.y, r * 1.9, 0, 2 * Math.PI); ctx.stroke(); ctx.setLineDash([]); }
    if (hot) { ctx.lineWidth = 1.2 / scale; ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.beginPath(); ctx.arc(n.x, n.y, r * 2.2, 0, 2 * Math.PI); ctx.stroke(); }
    if (n.kind && r * scale > 9) ctx.drawImage(emojiSprite(nIcon(n)), n.x - r * .66, n.y - r * .66, r * 1.32, r * 1.32);
  } else if ((g.nodeStyle === 'icons' || n.kind) && r * scale >= 6) {
    ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, 2 * Math.PI); ctx.fillStyle = mixHex(col, '#15151d', .72); ctx.fill();
    ctx.lineWidth = (hot ? 2.4 : 1.4) / scale; ctx.strokeStyle = hot ? '#fff' : col; ctx.setLineDash(n.kind && !n.open ? [3 / scale, 2 / scale] : []); ctx.stroke(); ctx.setLineDash([]);
    ctx.drawImage(emojiSprite(nIcon(n)), n.x - r * .78, n.y - r * .78, r * 1.56, r * 1.56);
  } else {
    ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, 2 * Math.PI); ctx.fillStyle = col; ctx.fill();
    if (hot) { ctx.lineWidth = 2 / scale; ctx.strokeStyle = '#fff'; ctx.stroke(); }
  }
  const show = n.kind || g.labels === 'always' || (g.labels === 'auto' && (scale > 1.4 || (hlSet && hlSet.has(n.id)) || sel || n.deg >= 8 && scale > .8));
  if (show && (g.labels !== 'off' || n.kind)) {
    const fs = n.kind ? Math.max(12.5 / scale, 2.5) : Math.max(11 / scale, 1.5);
    ctx.font = `${n.kind ? '600 ' : ''}${fs}px Segoe UI, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    const a = n.kind ? 1 : g.labels === 'auto' && !(hlSet && hlSet.has(n.id)) && !sel ? Math.min(1, (scale - 1.2) * 2.5) : 1;
    ctx.fillStyle = `rgba(232,232,242,${Math.max(dim ? .2 : a, n.deg >= 8 ? .9 : 0)})`;
    ctx.fillText(nName(n), n.x, n.y + r * (g.nodeStyle === 'glow' ? (n.kind ? 2.1 : 1.5) : 1) + 2 / scale);
  }
  ctx.globalAlpha = 1;
}
function buildGraph() {
  const el = $('#graph'); const g = state.graph;
  FG = new ForceGraph(el)
    .width(el.clientWidth).height(el.clientHeight).backgroundColor(GRAPH_BG())
    .nodeId('id').nodeRelSize(1).nodeVal(n => nodeR(n) ** 2).nodeLabel(() => '')
    .autoPauseRedraw(true).cooldownTicks(300).warmupTicks(20)
    .linkCurvature(l => l.curv || 0).linkDirectionalArrowLength(l => l.kind || !g.arrows ? 0 : 4).linkDirectionalArrowRelPos(1)
    .linkColor(l => {
      const on = !hlSet || (lid(l.source) === hlId || lid(l.target) === hlId);
      if (l.kind === 'contains') return `rgba(200,200,230,${on ? (hlSet ? .5 : .22) : .05})`;
      const col = g.linkColor ? relOf(l.type).color : '#8a8aa0';
      return hexA(col, on ? (hlSet ? .95 : (l.kind === 'agg' ? .26 : g.nodeStyle === 'glow' ? .38 : .55)) : .05);
    })
    .linkWidth(l => { const on = hlSet && (lid(l.source) === hlId || lid(l.target) === hlId); if (l.kind === 'contains') return on ? 1.5 : 1; const w = l.kind === 'agg' ? 1 + Math.log2(l.count) * .6 : 1; return on ? w + 1.2 : w; })
    .linkLineDash(l => l.kind === 'agg' ? [5, 3] : null)
    .linkLabel(l => l.kind === 'agg' ? `<div style="font:12px Segoe UI;padding:4px 6px">${l.count} link(s)<br>${Object.entries(l.types).map(([t, c]) => esc(relOf(t).label) + ': ' + c).join('<br>')}</div>` : (l.kind ? '' : esc(relOf(l.type).label)))
    .linkCanvasObjectMode(() => 'after')
    .linkCanvasObject((l, ctx, scale) => {
      const on = hlSet && (lid(l.source) === hlId || lid(l.target) === hlId);
      if (l.kind === 'contains') return;
      if (typeof l.source !== 'object') return;
      if (l.kind === 'agg') {
        if (!on && scale < 1.6 && !g.linkLabels) return;
        const mx = (l.source.x + l.target.x) / 2, my = (l.source.y + l.target.y) / 2, fs = 10 / scale, t = '×' + l.count;
        ctx.font = `600 ${fs}px Segoe UI, sans-serif`; const w = ctx.measureText(t).width;
        ctx.fillStyle = 'rgba(14,14,20,.85)'; ctx.beginPath(); ctx.roundRect(mx - w / 2 - 3 / scale, my - fs / 2 - 2 / scale, w + 6 / scale, fs + 4 / scale, 4 / scale); ctx.fill();
        ctx.fillStyle = relOf(l.type).color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(t, mx, my); return;
      }
      if (!(g.linkLabels && scale > 1.1 && (!hlSet || on)) && !(on && scale > 1.8)) return;
      const mx = (l.source.x + l.target.x) / 2, my = (l.source.y + l.target.y) / 2;
      const dx = l.target.x - l.source.x, dy = l.target.y - l.source.y, len = Math.hypot(dx, dy) || 1;
      const ox = l.curv ? -dy / len * l.curv * len / 2 : 0, oy = l.curv ? dx / len * l.curv * len / 2 : 0;
      const fs = 9 / scale; ctx.font = `${fs}px Segoe UI, sans-serif`; const text = relOf(l.type).label;
      const w = ctx.measureText(text).width;
      ctx.fillStyle = 'rgba(14,14,20,.85)'; ctx.fillRect(mx + ox - w / 2 - 2 / scale, my + oy - fs / 2 - 1 / scale, w + 4 / scale, fs + 2 / scale);
      ctx.fillStyle = g.linkColor ? relOf(l.type).color : '#c8c8d8'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, mx + ox, my + oy);
    })
    .onRenderFramePre(ctx => {
      if (g.nodeStyle !== 'glow') return;
      // stars are drawn in screen space from a pre-rendered tile, with a slight parallax
      const t = ctx.getTransform(), tile = starsTile(), S = tile.width, W = ctx.canvas.width, H = ctx.canvas.height;
      const ox = ((t.e * .25) % S + S) % S - S, oy = ((t.f * .25) % S + S) % S - S;
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
      for (let x = ox; x < W; x += S) for (let y = oy; y < H; y += S) ctx.drawImage(tile, x, y);
      ctx.restore();
    })
    .nodeCanvasObject(drawNode)
    .nodePointerAreaPaint((n, color, ctx) => { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(n.x, n.y, nodeR(n) + 2, 0, 2 * Math.PI); ctx.fill(); })
    .onNodeHover(n => { gHover = n || null; el.style.cursor = n ? 'pointer' : ''; setHighlight(); })
    .onNodeClick(n => {
      if (n.kind) { g.selFolder = n.path; g.infoOpen = true; toggleFolder(n.path); setHighlight(); renderGInfo(); if (g.expanded.has(n.path)) setTimeout(() => FG && n.x != null && FG.centerAt(n.x - ((($('#gpanel')?.offsetWidth || 0) - ($('#ginfo')?.offsetWidth || 0)) / 2) / FG.zoom(), n.y, 700), 600); return; }
      const now = Date.now(); if (n.id === state.selectedId && g.infoOpen && g.selFolder == null && now - (g.lastClick || 0) < 350) { openCard(n.id); return; }
      g.lastClick = now; g.selFolder = null; state.selectedId = n.id; g.infoOpen = true; setHighlight(); renderGInfo(); updateScopeLabel(); })
    .onBackgroundClick(() => { g.infoOpen = false; g.selFolder = null; setHighlight(); renderGInfo(); })
    .onNodeDragEnd(n => { n.fx = undefined; n.fy = undefined; });
  applyForces();
  gResize = new ResizeObserver(() => FG && FG.width(el.clientWidth).height(el.clientHeight)); gResize.observe(el);
  updateGraph(true);
  renderGInfo();
}
function applyForces() {
  if (!FG) return; const g = state.graph, k = g.nodeStyle === 'icons' ? 1.7 : 1;
  if (g.mode === 'tree') {
    FG.d3Force('charge').strength(n => (n.kind === 'root' ? -900 : n.kind ? -420 : -70) * k).distanceMax(900);
    FG.d3Force('link')
      .distance(l => l.kind === 'contains' ? (lid(l.target).startsWith('f:') ? 90 + 6 * Math.sqrt(l.target.count || 1) : 34) * k : l.kind === 'agg' ? 260 : 120)
      .strength(l => l.kind === 'contains' ? .9 : l.kind === 'agg' ? .02 : .04);
  } else {
    FG.d3Force('charge').strength(-55 * k * k).distanceMax(320 * k);
    FG.d3Force('link').distance(l => (22 + 5 * Math.sqrt((l.source.deg || 1) + (l.target.deg || 1))) * k).strength(l => 1 / Math.min(gAdj.get(lid(l.source))?.size || 1, gAdj.get(lid(l.target))?.size || 1));
  }
}
/* fit the graph into the area not covered by the side panels */
function fitView(ms = 500) {
  if (!FG) return; const el = $('#graph'), bb = FG.getGraphBbox(n => n.x != null); if (!bb) return;
  const W = el.clientWidth, H = el.clientHeight, pad = 60;
  const p = $('#gpanel'), inf = $('#ginfo');
  const L = p && !p.classList.contains('min') ? p.offsetWidth + 12 : 0, R = inf && !inf.classList.contains('hidden') ? inf.offsetWidth + 12 : 0;
  const bw = Math.max(bb.x[1] - bb.x[0], 1), bh = Math.max(bb.y[1] - bb.y[0], 1);
  const z = Math.max(.05, Math.min(8, Math.min((W - L - R - 2 * pad) / bw, (H - 2 * pad) / bh)));
  const cx = (bb.x[0] + bb.x[1]) / 2 - (L - R) / 2 / z, cy = (bb.y[0] + bb.y[1]) / 2;
  FG.zoom(z, ms); FG.centerAt(cx, cy, ms);
}

function graphPng() {
  const c = $('#graph canvas'); if (!c) return;
  const out = document.createElement('canvas'); out.width = c.width; out.height = c.height;
  const x = out.getContext('2d'); x.fillStyle = state.graph.nodeStyle === 'glow' ? '#05050b' : '#14141c'; x.fillRect(0, 0, out.width, out.height); x.drawImage(c, 0, 0);
  out.toBlob(b => download(b, `asterism-graph-${fileStamp()}.png`));
}
function download(blob, name) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
}
function updateGraph(fit) {
  if (!FG) return;
  const data = state.graph.mode === 'tree' ? treeData() : graphData(); FG.graphData(data);
  gAdj = new Map(); for (const l of data.links) { const a = lid(l.source), b = lid(l.target); if (!gAdj.has(a)) gAdj.set(a, new Set()); if (!gAdj.has(b)) gAdj.set(b, new Set()); gAdj.get(a).add(b); gAdj.get(b).add(a); }
  applyForces();
  const no = data.nodes.filter(n => !n.kind).length, nf = data.nodes.length - no;
  $('#gstat').textContent = `${nf ? nf + ' folders · ' : ''}${no} objects · ${data.links.filter(l => l.kind !== 'contains').length} links`;
  const lg = $('#glegend');
  lg.innerHTML = state.graph.colorBy === 'single' ? '' : [...groupColors].slice(0, 24).map(([k, c]) => `<span><span class="dot" style="--c:${esc(c)}"></span>${esc(state.graph.colorBy === 'template' ? (state.templates[k]?.name || k) : k)}</span>`).join('');
  setHighlight();
  if (fit) { let done = false; const f = () => { if (!done && FG) { done = true; fitView(500); } }; FG.onEngineStop(f); setTimeout(f, 1200); }
}
function updateScopeLabel() {
  const sel = state.objects.get(state.selectedId); const r = $('input[name=gscope][value=local]');
  if (r && sel) { r.disabled = false; r.parentElement.innerHTML = r.outerHTML + ` Around <b>${esc(sel.name)}</b>`; if (state.graph.local) $('input[name=gscope][value=local]').checked = true; }
}
function renderGInfo() {
  const box = $('#ginfo'); if (!box) return; const g = state.graph;
  if (g.infoOpen && g.selFolder != null && g.mode === 'tree') return renderFolderInfo(box);
  const o = state.objects.get(state.selectedId);
  if (!o || !g.infoOpen) { box.classList.add('hidden'); return; }
  box.classList.remove('hidden');
  const A = assignRefs(o.relations, o.template, o.customFields);
  const gchip = id => { const x = state.objects.get(id); return x ? `<span class="chip" data-act="g-goto" data-id="${esc(id)}">${objIcon(x, 'xs')}${esc(x.name)}</span>` : chipFor(id); };
  const fl = fieldList(o).filter(x => x.f.type === 'ref' ? (A.byField.get(x.label) || []).length : String(o.fields[x.label] ?? '') !== '').slice(0, 9);
  const out = groupBy(A.rest, r => r.type), inb = groupBy(state.inbound.get(o.id) || [], r => r.type);
  const grp = (m, inv) => [...m].map(([t, rs]) => `<div class="relgrp"><div class="rl"><span class="dot" style="--c:${esc(relOf(t).color)}"></span>${esc(inv ? relOf(t).inverse : relOf(t).label)}</div><div class="chips flat">${rs.map(r => gchip(inv ? r.from : r.target)).join('')}</div></div>`).join('');
  box.innerHTML = `<div style="display:flex;gap:10px;align-items:center">${objIcon(o)}<div style="min-width:0"><b>${esc(o.name)}</b><div class="dim mono" style="font-size:12px">${esc(o.id)} · ${esc(tplOf(o)?.name || '')}</div></div></div>
    <div class="dim" style="font-size:12px;margin:6px 0 10px">📁 ${esc(folderLabel(o.folder))}</div>
    ${fl.length ? `<div class="fields">${fl.map(({ f, label }) => `<div class="fl">${esc(label)}</div><div class="fv ${f.type === 'multiline' ? 'multi' : ''}">${f.type === 'ref' ? `<div class="chips flat">${A.byField.get(label).map(r => gchip(r.target)).join('')}</div>` : fieldValueHtml(f, String(o.fields[label]))}</div>`).join('')}</div>` : ''}
    <div style="margin-top:10px">${grp(out, false)}${grp(inb, true)}</div>
    <div style="display:flex;gap:6px;margin-top:10px"><button class="sm primary" data-act="g-open">Open card</button><button class="sm" data-act="g-local">Only its neighbourhood</button></div>`;
}
function renderFolderInfo(box) {
  const g = state.graph, path = g.selFolder, n = FG?.graphData().nodes.find(x => x.id === 'f:' + path);
  const objs = [...state.objects.values()].filter(o => !path || o.folder === path || o.folder.startsWith(path + '/'));
  const byT = [...groupBy(objs, o => o.template)].sort((a, b) => b[1].length - a[1].length);
  const links = FG ? FG.graphData().links.filter(l => l.kind === 'agg' && (lid(l.source) === 'f:' + path || lid(l.target) === 'f:' + path)).sort((a, b) => b.count - a.count) : [];
  box.classList.remove('hidden');
  box.innerHTML = `<div style="display:flex;gap:10px;align-items:center"><span class="ico" style="--c:${esc(n?.fcolor || '#9aa0c8')}">${esc(n?.icon || '📁')}</span><div style="min-width:0"><b>${esc(path ? path.split('/').at(-1) : 'Asterism')}</b><div class="dim" style="font-size:12px">📁 ${esc(folderLabel(path))} · ${objs.length} objects</div></div></div>
    <div class="subhead" style="margin-top:12px">Types</div><div class="chips flat">${byT.map(([k, l]) => `<span class="chip" style="cursor:default">${state.templates[k] ? `<span class="ico xs" style="--c:${esc(state.templates[k].color)}">${esc(state.templates[k].icon)}</span>` : ''}${esc(state.templates[k]?.name || k)} <span class="dim">${l.length}</span></span>`).join('')}</div>
    ${links.length ? `<div class="subhead" style="margin-top:12px">Linked with</div>${links.slice(0, 10).map(l => { const other = lid(l.source) === 'f:' + path ? l.target : l.source; return `<div class="relgrp" style="margin-bottom:6px"><div class="rl"><span class="dot" style="--c:${esc(relOf(l.type).color)}"></span><b style="color:var(--text)">${esc(nName(other))}</b> <span class="dim">×${l.count}</span></div><div class="dim" style="font-size:12px;padding-left:16px">${Object.entries(l.types).map(([t, c]) => esc(relOf(t).label) + ' ' + c).join(' · ')}</div></div>`; }).join('')}` : ''}
    <div style="display:flex;gap:6px;margin-top:12px"><button class="sm primary" data-act="g-folder-toggle">${g.expanded?.has(path) ? 'Close folder' : 'Open folder'}</button><button class="sm" data-act="g-folder-list">Show in list</button></div>`;
}

function flyTo(id) {
  if (!FG) return;
  const g = state.graph; let n = FG.graphData().nodes.find(x => x.id === id);
  if (!n && g.mode === 'tree' && state.objects.has(id)) {
    const segs = folderSegs(state.objects.get(id).folder), root = g.expandedRoot || '';
    for (let i = 0; i <= segs.length; i++) { const p = segs.slice(0, i).join('/'); if (!root || p === root || p.startsWith(root + '/')) g.expanded.add(p); }
    updateGraph(); n = FG.graphData().nodes.find(x => x.id === id);
    if (!n) return toast('Object is outside the current folder', 'warn');
    g.selFolder = null; state.selectedId = id; g.infoOpen = true; setHighlight(); renderGInfo();
    setTimeout(() => { if (FG && n.x != null) { FG.centerAt(n.x, n.y, 600); FG.zoom(Math.max(FG.zoom(), 2.2), 600); } }, 900);
    return;
  }
  if (!n) { g.local = true; state.selectedId = id; renderGraphView(); return; }
  g.selFolder = null; state.selectedId = id; g.infoOpen = true; setHighlight(); renderGInfo(); updateScopeLabel();
  if (n.x != null) { FG.centerAt(n.x, n.y, 600); FG.zoom(Math.max(FG.zoom(), 2.2), 600); }
}
function destroyGraph() {
  if (gResize) { gResize.disconnect(); gResize = null; }
  if (FG) { try { FG.pauseAnimation(); FG._destructor && FG._destructor(); } catch (e) { } FG = null; }
  gHover = null; hlSet = null;
}
function openCard(id) { state.selectedId = id; state.view = 'items'; state.mode = 'view'; state.tab = 'details'; render(); }
