/* ================= state ================= */
const state = {
  fs: null, relTypes: {}, templates: {}, objects: new Map(), inbound: new Map(), folders: new Map(),
  loadProblems: [], problems: [], dupMap: new Map(), hay: new Map(),
  view: 'items', filter: { kind: 'all', value: '' }, search: '', selectedId: null,
  mode: 'view', draft: null, tab: 'details', showEmpty: false, histSel: null,
  collapsed: new Set(), settingsSel: null, tplDraft: null, relDraft: null,
  graph: { mode: 'net', expanded: null, expandedRoot: null, selFolder: null, nodeStyle: 'glow', colorBy: 'template', labels: 'auto', arrows: true, linkColor: true, linkLabels: false, hidden: new Set(), hideOrphans: false, local: false, depth: 2, panelMin: false },
  storedHandle: null, welcomeMsg: '',
};
let FG = null, gNodeCache = new Map(), gHover = null, gResize = null;

/* ================= helpers ================= */
const tplOf = o => state.templates[o?.template];
const iconOf = o => o?.icon || tplOf(o)?.icon || '📄';
const colorOf = o => o?.color || tplOf(o)?.color || '#8b8d98';
const fieldDefs = o => [...(tplOf(o)?.fields || []), ...(o?.customFields || [])];
const CUSTOM_PREFIX = 'obj';
const relOf = k => state.relTypes[k] || { key: k, label: k, inverse: '← ' + k, color: '#8b8d98' };
const folderSegs = f => f ? f.split('/') : [];
const objPath = o => ['objects', ...folderSegs(o.folder), o.file];
const folderLabel = f => f ? f.split('/').join(' › ') : 'Objects (root)';
const isIP = v => /^(\d{1,3})(\.\d{1,3}){3}(\/\d{1,2})?$/.test(v.trim()) && v.split('/')[0].split('.').every(p => +p <= 255);
function fileNameFor(id, name) {
  let n = String(name).replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').replace(/\s+/g, ' ').trim().replace(/[. ]+$/, '');
  if (n.length > 80) n = n.slice(0, 80).trim();
  return n ? `${id} ${n}.md` : `${id}.md`;
}
const sanitizeFolder = s => String(s).replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').trim().replace(/[. ]+$/, '');
function objIcon(o, cls = '') { return `<span class="ico ${cls}" style="--c:${esc(colorOf(o))}">${esc(iconOf(o))}</span>`; }
function chipFor(id) {
  const o = state.objects.get(id);
  if (!o) return `<span class="chip bad" title="Object not found">⚠ ${esc(id)}</span>`;
  return `<span class="chip" data-act="goto" data-id="${esc(id)}" title="${esc(id)}">${objIcon(o, 'xs')}${esc(o.name)}</span>`;
}
/* relations of an object split into its template's reference fields and the rest */
function assignRefs(relations, tplKey, custom = []) {
  const refs = [...(state.templates[tplKey]?.fields || []), ...(custom || [])].filter(f => f.type === 'ref' && f.relation);
  const byField = new Map(refs.map(f => [f.label, []])); const rest = [];
  relations.forEach((r, i) => {
    const t = state.objects.get(r.target)?.template;
    const f = refs.find(f => f.relation === r.type && (!f.target || t === f.target));
    if (f) byField.get(f.label).push({ ...r, i }); else rest.push({ ...r, i });
  });
  return { refs, byField, rest };
}
const namesOf = ids => ids.map(id => state.objects.get(id)?.name || id).join('; ');
const prefs = (() => { try { return JSON.parse(localStorage.getItem('itreg.prefs') || '{}') || {}; } catch (e) { return {}; } })();
function savePrefs() { try { localStorage.setItem('itreg.prefs', JSON.stringify(prefs)); } catch (e) { } }
function incName(name, taken) {
  const m = String(name).match(/^(.*?)(\d+)(\D*)$/);
  let pre, num, w, suf;
  if (m) { pre = m[1]; num = +m[2]; w = m[2].length; suf = m[3]; } else { pre = (name || 'New') + ' '; num = 1; w = 1; suf = ''; }
  for (let i = 0; i < 10000; i++) { num++; const c = pre + String(num).padStart(w, '0') + suf; if (!taken.has(lc(c))) { taken.add(lc(c)); return c; } }
  return name + ' copy';
}
const allNames = () => new Set([...state.objects.values()].map(o => lc(o.name)));
function toast(msg, kind = '') {
  const t = document.createElement('div'); t.className = 'toast ' + kind; t.innerHTML = msg;
  $('#toasts').appendChild(t); setTimeout(() => t.remove(), kind === 'err' ? 7000 : 3500);
}
function mdRender(text) {
  try {
    return marked.parse(text || '', { gfm: true, breaks: true, renderer: Object.assign(new marked.Renderer(), { html: (t) => esc(typeof t === 'object' ? t.text : t) }) })
      .replace(/<a /g, '<a target="_blank" rel="noopener" ');
  } catch (e) { return `<pre>${esc(text)}</pre>`; }
}
