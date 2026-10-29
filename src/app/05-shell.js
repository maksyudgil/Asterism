/* ================= open / welcome ================= */
async function openFS(fs) {
  state.fs = fs; state.view = 'dashboard'; state.filter = { kind: 'all', value: '' }; state.selectedId = null; state.mode = 'view'; state.draft = null;
  renderShell();
  $('#main').innerHTML = '<div class="empty">Loading…</div>';
  try { await loadRegister(); } catch (e) { toast('Load failed: ' + esc(e.message), 'err'); console.error(e); }
  render();
}

async function resolveDataDir(h) {
  const names = new Set(); for await (const [n] of h.entries()) names.add(n);
  const isReg = s => s.has('objects') || s.has('_relations.yaml') || s.has('_templates');
  if (isReg(names)) return h;
  if (names.has('data')) {
    const d = await h.getDirectoryHandle('data'); const dn = new Set(); for await (const [n] of d.entries()) dn.add(n);
    if (isReg(dn)) return d;
  }
  const msg = names.size ? `The folder <b>${esc(h.name)}</b> is not a register yet (it has ${names.size} other item(s)).` : `The folder <b>${esc(h.name)}</b> is empty.`;
  if (!await confirmBox('Create a new register here?', `${msg}<br><br>Create the register structure (templates, relation types, folders) in it? No objects are created.`, 'Create')) return null;
  await initRegister(new RealFS(h)); return h;
}

async function initRegister(fs) {
  for (const [p, text] of Object.entries(window.DEMO_FILES)) {
    if (p.startsWith('objects/') && !p.endsWith('/_folder.yaml')) continue;
    if (p.startsWith('_history/')) continue;
    await fs.write(p.split('/'), text);
  }
  await fs.mkdir(['objects']); await fs.mkdir(['_history']);
}

async function pickFolder() {
  try {
    const h = await window.showDirectoryPicker({ id: 'asterism', mode: 'readwrite' });
    const root = await resolveDataDir(h); if (!root) return;
    try { await idb.set('root', root); } catch (e) { /* storage not available */ }
    await openFS(new RealFS(root));
  } catch (e) { if (e.name !== 'AbortError') { state.welcomeMsg = e.message; renderWelcome(); } }
}
async function reconnect() {
  const h = state.storedHandle; if (!h) return pickFolder();
  try { if (await h.requestPermission({ mode: 'readwrite' }) === 'granted') await openFS(new RealFS(h)); }
  catch (e) { state.welcomeMsg = 'Could not open the remembered folder: ' + e.message; renderWelcome(); }
}

function renderWelcome() {
  const supported = 'showDirectoryPicker' in window;
  $('#app').innerHTML = `<div class="welcome"><div class="wcard">
    <h1><b>◈</b> Asterism</h1>
    <p>Objects, templates and relations, stored as <code>.md</code> files in a shared folder.</p>
    <div class="btns">
      ${state.storedHandle ? `<button class="primary" data-act="reconnect">Open “${esc(state.storedHandle.name)}”</button>` : ''}
      <button class="${state.storedHandle ? '' : 'primary'}" data-act="pick" ${supported ? '' : 'disabled'}>Choose register folder…</button>
      <button data-act="demo">Try the demo (in memory, nothing is saved)</button>
    </div>
    ${supported ? `<p class="note">Choose the <b>data</b> folder next to this file (or the folder that contains it). The choice is remembered in this browser; next time just confirm access.</p>`
      : `<p class="err">This browser cannot open folders. Use Google Chrome or Microsoft Edge.</p>`}
    ${state.welcomeMsg ? `<p class="err">${esc(state.welcomeMsg)}</p>` : ''}
  </div></div><div id="modal-root"></div><div id="toasts"></div>`;
}

/* ================= shell ================= */
function renderShell() {
  $('#app').innerHTML = `
    <header class="top">
      <div class="logo" data-act="home" title="Dashboard"><b>◈</b> Asterism</div>
      <div class="search"><input type="search" id="q" placeholder="Search name, id, IP, tag, notes…  (Ctrl+K)" autocomplete="off"></div>
      <div class="seg" id="viewseg"><button data-act="view" data-v="items">Items</button><button data-act="view" data-v="graph">Graph</button></div>
      <div class="sp"></div>
      <button class="primary" data-act="new">+ New</button>
      <div class="fx" role="group" aria-label="Look and feel">
        <button class="fxbtn" id="fx-glass" data-act="fx-glass"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17" rx="4.5" fill="currentColor" fill-opacity=".14" stroke="currentColor" stroke-width="1.6"/><path d="M7.5 13.5 13.5 7.5M8 17.2 17.2 8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" opacity=".9"/></svg></button>
        <button class="fxbtn" id="fx-motion" data-act="fx-motion"><svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><ellipse cx="10.5" cy="14.2" rx="6.2" ry="3.9"/><circle cx="17.2" cy="10.6" r="2.7"/><ellipse cx="15.6" cy="5.4" rx="1.05" ry="3.3" transform="rotate(-20 15.6 5.4)"/><ellipse cx="18.4" cy="5.2" rx="1.05" ry="3.3" transform="rotate(12 18.4 5.2)"/><circle cx="4.1" cy="12.6" r="1.5"/><path d="M14.6 16.6 19.6 19.2" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/><path d="M6.4 16.9 2.4 19.6" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/><circle cx="18.2" cy="10.1" r=".55" fill="#0c0c13"/></svg></button>
      </div>
      <button class="ghost" data-act="export" title="Export to Excel / draw.io">⤓ Export</button>
      <button class="ghost" data-act="reload" title="Re-read the folder (see changes made by others)">↻ Reload</button>
      <button class="ghost" data-act="view" data-v="settings" title="Templates and relation types">⚙ Settings</button>
    </header>
    ${state.fs.kind === 'mem' ? '<div class="demo-banner">DEMO MODE: data lives in memory, changes are lost when the page is closed.</div>' : ''}
    <div class="main"><aside class="side" id="side"></aside><div id="main" style="flex:1;display:flex;min-width:0"></div></div>
    <datalist id="dl-tags"></datalist>
    <div id="modal-root"></div><div id="toasts"></div>`;
  applyAppearance();
  let t; $('#q').addEventListener('input', e => { clearTimeout(t); t = setTimeout(() => { state.search = e.target.value; if (state.view === 'dashboard' || state.view === 'settings') { if (!state.search) return; state.view = 'items'; render(); } else if (state.view === 'items') renderList(); else if (state.view === 'graph') updateGraph(); }, 90); });
}

function render() {
  if (!state.fs) return renderWelcome();
  $$('#viewseg button').forEach(b => b.classList.toggle('on', b.dataset.v === state.view));
  renderDatalists(); renderSide(); renderMain();
}

function renderDatalists() {
  const tags = new Set(); state.objects.forEach(o => o.tags.forEach(t => tags.add(t)));
  $('#dl-tags').innerHTML = [...tags].sort().map(t => `<option value="${esc(t)}">`).join('');
}
function folderCounts() {
  const c = new Map();
  for (const o of state.objects.values()) { const s = folderSegs(o.folder); for (let i = 0; i <= s.length; i++) { const k = s.slice(0, i).join('/'); c.set(k, (c.get(k) || 0) + 1); } }
  return c;
}
function renderSide() {
  const f = state.filter, on = (k, v) => f.kind === k && f.value === v && state.view !== 'settings' ? 'on' : '';
  const counts = folderCounts();
  const children = new Map();
  for (const k of state.folders.keys()) { if (!k) continue; const p = k.split('/').slice(0, -1).join('/'); if (!children.has(p)) children.set(p, []); children.get(p).push(k); }
  const tree = (parent, depth) => (children.get(parent) || []).sort((a, b) => a.localeCompare(b)).map(k => {
    const has = children.has(k), col = state.collapsed.has(k);
    return `<div class="item ${on('folder', k)}" data-act="filter" data-k="folder" data-v="${esc(k)}" data-drop-folder="${esc(k)}" ${prefs.dnd ? `draggable="true" data-drag-folder="${esc(k)}"` : ''} style="padding-left:${6 + depth * 14}px">
        <span class="car" ${has ? `data-act="toggle-folder" data-path="${esc(k)}"` : ''}>${has ? (col ? '▶' : '▼') : ''}</span>
        <span>📁</span><span class="fname">${esc(k.split('/').at(-1))}</span>
        <button class="ghost sm more" data-act="folder-menu" data-path="${esc(k)}" title="Folder actions">⋯</button>
        <span class="cnt">${counts.get(k) || 0}</span></div>` + (has && !col ? tree(k, depth + 1) : '');
  }).join('');
  const tcount = {}; for (const o of state.objects.values()) tcount[o.template] = (tcount[o.template] || 0) + 1;
  const tags = {}; for (const o of state.objects.values()) o.tags.forEach(t => tags[t] = (tags[t] || 0) + 1);
  const np = state.problems.length;
  $('#side').innerHTML = `${prefs.dnd ? '<div class="dropzone-top" data-drop-folder="">⤒ Drop here: move to top level</div>' : ''}
    <div class="item ${on('all', '')}" data-act="filter" data-k="all" data-v="" ${prefs.dnd ? 'data-drop-folder=""' : ''}><span>🗂</span>All items<span class="cnt">${state.objects.size}</span></div>
    <div class="item ${on('problems', '')} ${np ? 'warn' : ''}" data-act="filter" data-k="problems" data-v=""><span>⚠</span>Problems<span class="cnt">${np}</span></div>
    <div class="sec" data-drop-folder="">Folders <span style="display:flex;gap:2px"><button class="ghost dndpill ${prefs.dnd ? 'on' : ''}" data-act="toggle-dnd" title="Drag & drop: move objects and folders by dragging">✥ ${prefs.dnd ? 'Drag on' : 'Drag off'}</button><button class="ghost" data-act="new-folder" data-path="" title="New top-level folder">+</button></span></div>
    ${prefs.dnd ? '<div class="dndhint">Drag objects from the list onto a folder. Drag a folder onto another folder, or onto the “top level” zone that appears while dragging.</div>' : ''}
    <div class="tree">${tree('', 0) || '<div class="dim" style="padding:4px 10px">No folders</div>'}</div>
    <div class="sec">Types</div>
    ${Object.values(state.templates).sort((a, b) => a.name.localeCompare(b.name)).map(t => `<div class="item ${on('template', t.key)}" data-act="filter" data-k="template" data-v="${esc(t.key)}">${`<span class="ico xs" style="--c:${esc(t.color)}">${esc(t.icon)}</span>`}${esc(t.name)}<span class="cnt">${tcount[t.key] || 0}</span></div>`).join('')}
    <div class="sec">Tags</div>
    <div class="tagcloud">${Object.keys(tags).sort().map(t => `<span class="tag ${on('tag', t)}" data-act="filter" data-k="tag" data-v="${esc(t)}">#${esc(t)} <span class="dim">${tags[t]}</span></span>`).join('') || '<span class="dim">No tags</span>'}</div>
    <div class="foot"><div>📂 ${esc(state.fs.name)}</div><div class="row2"><button class="sm" data-act="close-register">Switch folder</button></div></div>`;
}

/* ---------- main ---------- */
function renderMain() {
  if (state.view !== 'graph') destroyGraph();
  const m = $('#main');
  if (state.view === 'graph') return renderGraphView();
  if (state.view === 'settings') return renderSettings();
  if (state.view === 'dashboard') return renderDashboard();
  if (!$('#list', m) || !$('#detail', m)) m.innerHTML = '<section class="list" id="list"></section><section class="detail" id="detail"></section>';
  renderList(); renderDetail();
}

function filterTitle() {
  const f = state.filter;
  if (f.kind === 'folder') return '📁 ' + (f.value.split('/').at(-1) || 'Objects');
  if (f.kind === 'tag') return '#' + f.value;
  if (f.kind === 'template') return state.templates[f.value]?.name || f.value;
  if (f.kind === 'problems') return 'Problems';
  return 'All items';
}
function subtitle(o) {
  const v = fieldLike(o, /^ip/i) || o.fields['Hostname'] || o.fields['Role'] || o.fields['Hosting'] || '';
  return [o.id, v || tplOf(o)?.name].filter(Boolean).join(' · ');
}
function renderList() {
  const el = $('#list'); if (!el) return;
  const st = $('.rows', el)?.scrollTop || 0;
  if (state.filter.kind === 'problems') {
    el.innerHTML = `<div class="list-head"><b>Problems</b><span>${state.problems.length}</span></div><div class="rows">${state.problems.map(p => `
      <div class="prob ${p.id && state.objects.has(p.id) ? 'link' : ''}" ${p.id && state.objects.has(p.id) ? `data-act="goto" data-id="${esc(p.id)}"` : ''}>
        <span class="pi">${p.sev === 'err' ? '⛔' : '⚠️'}</span><div>${esc(p.msg)}${p.id ? `<small>${esc(p.id)}</small>` : ''}</div></div>`).join('') || '<div class="empty">No problems found 🎉</div>'}</div>`;
    return;
  }
  const list = filteredObjects();
  el.innerHTML = `<div class="list-head"><b>${esc(filterTitle())}</b><span>${list.length} item${list.length === 1 ? '' : 's'}</span></div>
    <div class="rows">${list.map(o => {
      const dup = (tplOf(o)?.fields || []).some(f => state.dupMap.has(o.id + '\u0000' + f.label));
      return `<div class="row ${o.id === state.selectedId ? 'on' : ''} ${prefs.dnd ? 'drag' : ''}" data-act="open" data-id="${esc(o.id)}" ${prefs.dnd ? 'draggable="true"' : ''}>${objIcon(o)}
        <div><div class="nm">${esc(o.name)}</div><div class="sub">${esc(subtitle(o))}</div></div>${dup ? '<span class="badge" title="Duplicate value">⚠</span>' : ''}</div>`;
    }).join('') || `<div class="empty">${state.search ? 'Nothing matches the search' : 'No items here yet'}</div>`}</div>`;
  $('.rows', el).scrollTop = st;
}

/* ---------- dashboard ---------- */
function renderDashboard() {
  const objs = [...state.objects.values()];
  const nrel = objs.reduce((s, o) => s + o.relations.length, 0);
  const crit = objs.filter(isCrit);
  const byT = [...groupBy(objs, o => o.template)].sort((a, b) => b[1].length - a[1].length);
  const personRef = f => f.type === 'ref' && state.templates[f.target] && (f.target === 'person' || /person|people/i.test(state.templates[f.target].name));
  const gaps = [];
  for (const o of objs) {
    const A = assignRefs(o.relations, o.template, o.customFields);
    const miss = fieldDefs(o).filter(f => personRef(f) && /owner/i.test(f.label) && !(A.byField.get(f.label) || []).length).map(f => f.label);
    if (miss.length) gaps.push({ o, miss });
  }
  const gapCrit = gaps.filter(g => crit.includes(g.o));
  const recent = objs.filter(o => o.updated).sort((a, b) => b.updated.localeCompare(a.updated)).slice(0, 8);
  const tops = [...state.folders.keys()].filter(k => k && !k.includes('/')).sort().map(k => ({ k, n: objs.filter(o => o.folder === k || o.folder.startsWith(k + '/')).length }));
  const bps = objs.filter(o => /process/i.test(o.template) && crit.includes(o));
  const tagged = objs.filter(o => o.tags.includes('to-identify'));
  const errs = state.problems.filter(p => p.sev === 'err').length;
  const row = o => `<div class="dl" data-act="goto" data-id="${esc(o.id)}">${objIcon(o, 'xs')}<span class="nm">${esc(o.name)}</span>`;
  $('#main').innerHTML = `<section class="dash"><div class="dash-in">
    <div class="dash-head"><div><h1>◈ Asterism</h1><div class="muted">${esc(state.fs.name)} · ${nowStamp().slice(0, 10)}</div></div>
      <div style="display:flex;gap:8px"><button class="primary" data-act="new">+ New</button><button data-act="export">⤓ Export</button><button data-act="dash-graph">🗂️ Structure graph</button></div></div>
    <div class="kpis">
      <div class="kpi" data-act="filter" data-k="all" data-v=""><b>${objs.length}</b>objects</div>
      <div class="kpi" data-act="view" data-v="graph"><b>${nrel}</b>relations</div>
      <div class="kpi"><b>${crit.length}</b>critical</div>
      <div class="kpi ${gaps.length ? 'warn' : ''}"><b>${gaps.length}</b>missing owner</div>
      <div class="kpi ${state.problems.length ? (errs ? 'err' : 'warn') : ''}" data-act="filter" data-k="problems" data-v=""><b>${state.problems.length}</b>problems</div>
    </div>
    <div class="dash-grid">
      <div class="card span2"><h3>By type</h3><div class="ttiles">${byT.map(([k, l]) => { const t = state.templates[k]; return `<div class="ttile" data-act="filter" data-k="template" data-v="${esc(k)}"><span class="ico" style="--c:${esc(t?.color || '#8b8d98')}">${esc(t?.icon || '✳️')}</span><span><b>${l.length}</b><small>${esc(t?.name || (k ? k : 'Custom'))}</small></span></div>`; }).join('')}</div></div>
      <div class="card"><h3>Folders</h3>${tops.map(t => `<div class="dl" data-act="filter" data-k="folder" data-v="${esc(t.k)}"><span>📁</span><span class="nm">${esc(t.k)}</span><span class="dim">${t.n}</span></div>`).join('')}</div>
      <div class="card"><h3>Needs attention</h3>
        ${gapCrit.length ? `<div class="subhead">Critical without owner (${gapCrit.length})</div>${gapCrit.slice(0, 6).map(g => row(g.o) + `<span class="dim">${esc(g.miss.join(', '))}</span></div>`).join('')}` : ''}
        ${gaps.length > gapCrit.length ? `<div class="subhead" style="margin-top:8px">Missing owner (${gaps.length - gapCrit.length} more)</div>${gaps.filter(g => !gapCrit.includes(g)).slice(0, 5).map(g => row(g.o) + `<span class="dim">${esc(g.miss.join(', '))}</span></div>`).join('')}` : ''}
        ${tagged.length ? `<div class="dl" data-act="filter" data-k="tag" data-v="to-identify"><span>🏷️</span><span class="nm">#to-identify</span><span class="dim">${tagged.length}</span></div>` : ''}
        ${state.problems.length ? `<div class="dl" data-act="filter" data-k="problems" data-v=""><span>⚠</span><span class="nm">Problems</span><span class="dim">${state.problems.length}</span></div>` : ''}
        ${!gaps.length && !tagged.length && !state.problems.length ? '<div class="dim">All good 🎉</div>' : ''}</div>
      <div class="card"><h3>Recently changed</h3>${recent.map(o => row(o) + `<span class="dim">${esc(fmtStamp(o.updated).slice(0, 16))}</span></div>`).join('') || '<div class="dim">Nothing yet</div>'}</div>
      ${bps.length ? `<div class="card span2"><h3>Critical business processes</h3><div class="bpl">${bps.sort((a, b) => a.name.localeCompare(b.name)).map(b => { const uses = b.relations.filter(r => r.type === 'uses').length; const bo = b.relations.filter(r => r.type === 'business_owner').map(r => state.objects.get(r.target)?.name).filter(Boolean); return row(b) + `<span class="dim">${uses} dependencies${bo.length ? ' · ' + esc(bo.join(', ')) : ''}</span></div>`; }).join('')}</div></div>` : ''}
    </div></div></section>`;
}
