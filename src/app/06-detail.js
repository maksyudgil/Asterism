/* ---------- detail: view ---------- */
let detailKey = '';
function renderDetail() {
  const el = $('#detail'); if (!el) return;
  const key = state.mode + '|' + state.selectedId + '|' + state.tab + '|' + (state.draft?.isNew ? 'new' : '');
  const fresh = key !== detailKey; detailKey = key;
  if (state.mode === 'edit' && state.draft) { renderEdit(el); if (fresh) $('.d-wrap', el)?.classList.add('enter'); return; }
  const o = state.objects.get(state.selectedId);
  if (!o) {
    const nrel = [...state.objects.values()].reduce((s, o) => s + o.relations.length, 0);
    el.innerHTML = `<div class="welcome-detail"><div class="stats">
      <div class="stat"><b>${state.objects.size}</b>objects</div><div class="stat"><b>${nrel}</b>relations</div>
      <div class="stat"><b>${Object.keys(state.templates).length}</b>templates</div><div class="stat"><b>${state.problems.length}</b>problems</div></div>
      Select an item on the left, or create a new one with <b>+ New</b>.<br>
      <span class="dim"><kbd>Ctrl</kbd>+<kbd>K</kbd> search · <kbd>E</kbd> edit · <kbd>Ctrl</kbd>+<kbd>S</kbd> save · <kbd>Esc</kbd> cancel</span></div>`;
    return;
  }
  const tpl = tplOf(o);
  el.innerHTML = `<div class="d-wrap ${fresh ? 'enter' : ''}">
    <div class="d-head">${objIcon(o, 'big')}
      <div style="min-width:0"><h1>${esc(o.name)}</h1>
        <div class="meta"><span class="mono">${esc(o.id)}</span><span>${esc(tpl?.name || o.template)}</span><span>📁 ${esc(folderLabel(o.folder))}</span></div>
        <div class="tags">${o.tags.map(t => `<span class="tag" data-act="filter" data-k="tag" data-v="${esc(t)}">#${esc(t)}</span>`).join('')}</div></div>
      <div class="actions">
        <button class="primary" data-act="edit">Edit</button>
        <button data-act="dup">Duplicate</button>
        <button data-act="multi">Create multiple</button>
        <button data-act="graph-local" title="Open this object in the graph">Graph</button>
        <button class="ghost" data-act="obj-menu" title="More">⋯</button>
      </div></div>
    <div class="tabs"><a data-act="tab" data-tab="details" class="${state.tab === 'details' ? 'on' : ''}">Details</a><a data-act="tab" data-tab="history" class="${state.tab === 'history' ? 'on' : ''}">History</a></div>
    <div id="tabbody">${state.tab === 'history' ? '<div class="dim">Loading history…</div>' : detailsHtml(o)}</div></div>`;
  if (state.tab === 'history') renderHistory(o);
}

function fieldValueHtml(f, v) {
  switch (f?.type) {
    case 'url': return /^https?:\/\//i.test(v) ? `<a href="${esc(v)}" target="_blank" rel="noopener">${esc(v)}</a>` : esc(v);
    case 'ip': return `<span class="mono">${esc(v)}</span>`;
    case 'boolean': return truthy(v) ? '✅ Yes' : 'No';
    default: return esc(v);
  }
}
function fieldList(o) {   // template fields, then the object's own typed fields, then untyped extra values
  const defs = fieldDefs(o), tcount = (tplOf(o)?.fields || []).length;
  const out = defs.map((f, i) => ({ f, label: f.label, custom: i >= tcount }));
  const tl = new Set(defs.map(f => f.label));
  for (const k of Object.keys(o.fields)) if (!tl.has(k)) out.push({ f: { label: k, type: String(o.fields[k]).includes('\n') ? 'multiline' : 'text' }, label: k, custom: true });
  return out;
}
function detailsHtml(o) {
  const A = assignRefs(o.relations, o.template, o.customFields);
  const fl = fieldList(o);
  const has = x => x.f.type === 'ref' ? (A.byField.get(x.label) || []).length > 0 : String(o.fields[x.label] ?? '') !== '';
  const shown = fl.filter(x => state.showEmpty || has(x));
  const nEmpty = fl.filter(x => !has(x)).length;
  const fields = shown.map(({ f, label, custom }) => {
    if (f.type === 'ref') {
      const rs = A.byField.get(label) || [];
      return `<div class="fl" title="${esc(relOf(f.relation).label)}">${esc(label)}</div>
        <div class="fv">${rs.length ? `<div class="chips flat">${rs.map(r => chipFor(r.target)).join('')}</div>` : '<span class="dim">—</span>'}</div>`;
    }
    const v = String(o.fields[label] ?? '');
    const dups = state.dupMap.get(o.id + '\u0000' + label);
    return `<div class="fl" title="${custom ? 'Custom field (not in template)' : ''}">${esc(label)}${custom ? ' <span class="dim">*</span>' : ''}</div>
      <div class="fv ${f.type === 'multiline' ? 'multi' : ''}">${v ? fieldValueHtml(f, v) : '<span class="dim">—</span>'}${v && f.type !== 'boolean' ? `<button class="sm copy" data-act="copy" data-v="${esc(v)}">Copy</button>` : ''}
      ${dups ? `<div class="dupwarn">⚠ Same value in: ${dups.map(d => `<a data-act="goto" data-id="${esc(d)}">${esc(state.objects.get(d)?.name || d)}</a>`).join(', ')}</div>` : ''}</div>`;
  }).join('');
  const out = groupBy(A.rest, r => r.type);
  const inb = groupBy(state.inbound.get(o.id) || [], r => r.type);
  const grp = (map, inverse) => [...map].map(([type, rs]) => {
    const rt = relOf(type);
    return `<div class="relgrp"><div class="rl"><span class="dot" style="--c:${esc(rt.color)}"></span>${esc(inverse ? rt.inverse : rt.label)}</div>
      <div class="chips">${rs.map(r => chipFor(inverse ? r.from : r.target)).join('')}</div></div>`;
  }).join('');
  const rels = (out.size ? `<div class="subhead">Outgoing</div>${grp(out, false)}` : '') + (inb.size ? `<div class="subhead" style="margin-top:12px">Incoming</div>${grp(inb, true)}` : '');
  return `<div class="grid2"><div>
      <div class="card"><h3>Fields<span class="sp"></span>${nEmpty ? `<button class="ghost sm" data-act="toggle-empty">${state.showEmpty ? 'Hide' : 'Show'} empty (${nEmpty})</button>` : ''}</h3>
        ${fields ? `<div class="fields">${fields}</div>` : '<div class="dim">No values yet. Click Edit to fill in.</div>'}</div>
      ${o.notes ? `<div class="card"><h3>Notes</h3><div class="notes">${mdRender(o.notes)}</div></div>` : ''}
    </div><div>
      <div class="card"><h3>Relations</h3>${rels || '<div class="dim">No other relations.</div>'}</div>
    </div></div>
    <div class="foot-meta"><span>Created ${esc(fmtStamp(o.created) || '—')}</span><span>Updated ${esc(fmtStamp(o.updated) || '—')}</span><span class="mono">${esc(objPath(o).join('/'))}</span></div>`;
}
function groupBy(list, fn) { const m = new Map(); for (const x of list) { const k = fn(x); if (!m.has(k)) m.set(k, []); m.get(k).push(x); } return m; }

/* ---------- detail: edit ---------- */
function makeDraft(o) {
  const d = clone({ ...o, mtime: undefined });
  d.isNew = false; d.origId = o.id; d.reset = []; d.dirty = false; d.customFields = clone(o.customFields || []);
  const f = {};
  fieldDefs(o).filter(x => x.type !== 'ref').forEach(x => f[x.label] = o.fields[x.label] ?? '');
  for (const k of Object.keys(o.fields)) if (!(k in f)) f[k] = o.fields[k];
  d.fields = f; return d;
}
function newDraft(template, folder) {
  const f = {}; (state.templates[template]?.fields || []).filter(x => x.type !== 'ref').forEach(x => f[x.label] = '');
  return { isNew: true, id: '', name: '', template, icon: '', color: '', folder, tags: [], fields: f, customFields: [], relations: [], notes: '', extra: {}, reset: [], dirty: false };
}
function startEdit(d) { state.draft = d; state.mode = 'edit'; state.tab = 'details'; if (state.view !== 'items') state.view = 'items'; render(); setTimeout(() => { const n = $('.ename'); n && !d.name && n.focus(); }, 0); }

function inputFor(f, v, label, reset) {
  const a = `data-bind="field" data-key="${esc(label)}" class="${reset ? 'reset' : ''}"`;
  switch (f.type) {
    case 'multiline': return `<textarea ${a} rows="3">${esc(v)}</textarea>`;
    case 'date': return `<input type="date" ${a} value="${esc(v)}">`;
    case 'number': return `<input type="number" ${a} value="${esc(v)}">`;
    case 'boolean': return `<label class="chk" style="padding-top:6px"><input type="checkbox" ${a} ${truthy(v) ? 'checked' : ''}> Yes</label>`;
    case 'select': { const opts = [...f.options]; if (v && !opts.includes(v)) opts.push(v); return `<select ${a}><option value=""></option>${opts.map(o => `<option ${o === v ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`; }
    case 'ip': return `<input type="text" ${a} value="${esc(v)}" placeholder="10.0.0.1" class="mono ${reset ? 'reset' : ''}">`;
    case 'url': return `<input type="text" ${a} value="${esc(v)}" placeholder="https://">`;
    default: return `<input type="text" ${a} value="${esc(v)}">`;
  }
}
function renderEdit(el) {
  const d = state.draft, tpl = state.templates[d.template] || { fields: [], relations: [], name: d.template ? d.template + ' (missing)' : 'Custom object', prefix: CUSTOM_PREFIX, icon: '📄', color: '#8b8d98' };
  const A = assignRefs(d.relations, d.template, d.customFields);
  const flags = f => [f.required && 'required', f.unique && 'unique: ' + f.unique, f.reset_on_copy && 'reset on copy'].filter(Boolean).join(' · ');
  const tfLabels = new Set([...tpl.fields, ...d.customFields].map(f => f.label));
  const rowFor = (f, custom, typed) => {
    const label = f.label;
    const head = `<div class="fl" title="${esc(flags(f))}">${esc(label)}${f.required ? ' <span class="req">*</span>' : ''}${custom ? `<span class="flag">own field${typed ? ' · ' + esc(FIELD_TYPE_LABELS[f.type] || f.type) : ''}</span>` : (flags(f) ? `<span class="flag">${esc(flags(f))}</span>` : (f.type === 'ref' ? `<span class="flag">${esc(relOf(f.relation).label)}${f.target ? ' → ' + esc(state.templates[f.target]?.name || f.target) : ''}</span>` : ''))}</div>`;
    if (f.type === 'ref') {
      const rs = A.byField.get(label) || [];
      return head + `<div class="refbox ${d.reset.includes(label) ? 'reset' : ''}">${rs.map(r => `<span class="chip edit">${chipInner(r.target)}<span class="x" data-act="rm-rel" data-i="${r.i}" title="Remove">✕</span></span>`).join('')}
          <button class="sm ${rs.length && !f.multiple ? 'ghost' : ''}" data-act="ref-add" data-key="${esc(label)}">${rs.length && !f.multiple ? 'Change…' : '+ Add'}</button></div><div>${custom ? `<button class="ghost sm" data-act="rm-field" data-key="${esc(label)}" title="Remove field">✕</button>` : ''}</div>
        <div class="msg" data-msg="${esc(label)}"></div>`;
    }
    return head + `<div>${inputFor(f, d.fields[label] ?? '', label, d.reset.includes(label))}</div>
      <div>${custom ? `<button class="ghost sm" data-act="rm-field" data-key="${esc(label)}" title="Remove field">✕</button>` : ''}</div>
      <div class="msg" data-msg="${esc(label)}"></div>`;
  };
  const fields = tpl.fields.map(f => rowFor(f, false)).join('') + d.customFields.map(f => rowFor(f, true, true)).join('') +
    Object.keys(d.fields).filter(k => !tfLabels.has(k)).map(k => rowFor({ label: k, type: String(d.fields[k]).includes('\n') ? 'multiline' : 'text' }, true)).join('');
  const relOpts = sel => Object.values(state.relTypes).map(r => `<option value="${esc(r.key)}" ${r.key === sel ? 'selected' : ''}>${esc(r.label)}</option>`).join('') + (sel && !state.relTypes[sel] ? `<option selected value="${esc(sel)}">${esc(sel)} (unknown)</option>` : '');
  const groups = groupBy(A.rest.filter(r => r.target), r => r.type);
  for (const t of d.relGroups || []) if (!groups.has(t)) groups.set(t, []);
  const rels = [...groups].map(([type, rs]) => `<div class="rg">
      <div class="rg-type"><span class="dot" style="--c:${esc(relOf(type).color)}"></span><select data-bind="group-type" data-type="${esc(type)}" title="Change the relation type of all objects in this row">${relOpts(type)}</select></div>
      <div class="refbox">${rs.map(r => `<span class="chip edit" data-act="chip-menu" data-i="${r.i}" title="Click to change type">${chipInner(r.target)}<span class="x" data-act="rm-rel" data-i="${r.i}" title="Remove">✕</span></span>`).join('')}
        <button class="sm" data-act="group-add" data-type="${esc(type)}">+ Add</button></div>
      <div>${rs.length ? '' : `<button class="ghost sm" data-act="group-drop" data-type="${esc(type)}" title="Remove empty row">✕</button>`}</div>
      ${rs.map(r => `<div class="msg" data-msg="rel${r.i}"></div>`).join('')}</div>`).join('');
  const sugg = tpl.relations.map((r, i) => `<button class="sm" data-act="add-rel" data-si="${i}"><span class="dot" style="--c:${esc(relOf(r.type).color)};display:inline-block"></span> ${esc(relOf(r.type).label)} → ${esc(state.templates[r.target]?.name || r.target || 'any')}</button>`).join('');
  const folders = [...state.folders.keys()].sort();
  el.innerHTML = `<div class="d-wrap edit">
    <div class="d-head"><button class="ico big icobtn" style="--c:${esc(d.color || tpl.color || '#888')}" data-act="pick-icon" title="Change icon and colour">${esc(d.icon || tpl.icon || '📄')}</button>
      <div style="flex:1;min-width:0"><input class="ename ${d.reset.includes('__name') ? 'reset' : ''}" data-bind="name" value="${esc(d.name)}" placeholder="Name">
        <div class="msg" data-msg="__name"></div>
        <div class="meta" style="color:var(--muted);font-size:12.5px;margin-top:6px;align-items:center">${d.isNew ? `id will be assigned on save (<span class="mono">${esc(tpl.prefix)}-NNNN</span>)` : `<span class="mono">${esc(d.id)}</span>`}
          <span>Type <select data-bind="template" style="width:auto;padding:2px 8px;margin-left:4px">${Object.values(state.templates).sort((a, b) => a.name.localeCompare(b.name)).map(t => `<option value="${esc(t.key)}" ${t.key === d.template ? 'selected' : ''}>${esc(t.icon)} ${esc(t.name)}</option>`).join('')}<option value="" ${!d.template ? 'selected' : ''}>✳️ Custom (no template)</option></select></span></div></div></div>
    <div class="card" style="margin-top:18px">
      <div class="erow"><label>Folder</label><select data-bind="folder">${folders.map(f => `<option value="${esc(f)}" ${f === d.folder ? 'selected' : ''}>${esc(folderLabel(f))}</option>`).join('')}</select></div>
      <div class="erow"><label>Tags</label><div class="tagedit" id="tagedit">${d.tags.map(t => `<span class="tag">#${esc(t)}<span class="x" data-act="rm-tag" data-tag="${esc(t)}">✕</span></span>`).join('')}<input list="dl-tags" id="tagin" placeholder="add tag, Enter"></div></div>
    </div>
    <div class="card"><h3>Fields</h3><div class="efields">${fields}</div>
      <div style="margin-top:10px"><button class="sm" data-act="add-field">+ Add field</button></div></div>
    <div class="card"><h3>Other relations</h3><div class="rgs">${rels || '<div class="dim" style="margin-bottom:8px">No other relations.</div>'}</div>
      ${sugg ? `<div class="rel-sugg"><span class="dim" style="align-self:center">Suggested:</span>${sugg}</div>` : ''}
      <button class="sm" data-act="add-rel">+ Add relation</button></div>
    <div class="card"><h3>Notes <span class="dim" style="text-transform:none;letter-spacing:0;font-weight:400">Markdown</span></h3><textarea data-bind="notes" rows="6">${esc(d.notes)}</textarea></div>
    <div class="savebar"><button class="primary" data-act="save">${d.isNew ? 'Create' : 'Save'}</button><button data-act="cancel">Cancel</button>
      <span class="hint"><kbd>Ctrl</kbd>+<kbd>S</kbd> save · <kbd>Esc</kbd> cancel${d.reset.length ? ' · <span style="color:var(--warn)">highlighted fields were cleared when copying</span>' : ''}</span></div></div>`;
}
/* changing the type of an object: fields of the old type that have values (or are refs) become the object's own fields */
function switchTemplate(d, key) {
  if (key === d.template) return;
  const oldT = state.templates[d.template], newT = state.templates[key];
  const newLabels = new Set((newT?.fields || []).map(f => f.label));
  const A = assignRefs(d.relations, d.template, d.customFields);
  for (const f of oldT?.fields || []) {
    if (newLabels.has(f.label) || d.customFields.some(x => x.label === f.label)) continue;
    const used = f.type === 'ref' ? (A.byField.get(f.label) || []).length : String(d.fields[f.label] ?? '') !== '';
    if (used) d.customFields.push(clone(f)); else delete d.fields[f.label];
  }
  d.customFields = d.customFields.filter(f => !newLabels.has(f.label));
  for (const f of newT?.fields || []) if (f.type !== 'ref' && !(f.label in d.fields)) d.fields[f.label] = '';
  d.template = key; d.dirty = true;
  if (d.isNew && newT && !d.icon) d.icon = '';
  renderEditKeep();
}
async function iconPicker(cur = '', color = '', fallback = { icon: '📄', color: '#8b8d98' }) {
  const EMO = ['🖥️', '💻', '🖨️', '📶', '🛜', '🔀', '📡', '🛡️', '🔒', '🔐', '🔑', '🗝️', '🗄️', '💾', '💽', '🧮', '⚙️', '🧩', '🌐', '☁️', '🏢', '🏛️', '🏦', '🏠', '🏭', '📍', '🌍',
    '👤', '👥', '🧑‍💻', '📱', '☎️', '📞', '📹', '📷', '💡', '🔌', '🔋', '🖱️', '⌨️', '📺', '🎛️', '🛰️', '🤖', '🧠', '📊', '📈', '🗂️', '📁', '📄', '📝', '🧾', '📃', '📦', '🧰', '🔧',
    '🛠️', '🧪', '🧱', '🗃️', '✉️', '📧', '🔔', '⏱️', '📅', '🧭', '🚪', '🪪', '🎫', '💳', '💶', '💼', '📚', '🛒', '🚚', '✳️', '⭐', '🔥', '❄️', '🌱', '🧬', '⚡', '🔗', '🏷️'];
  return new Promise(resolve => {
    const state2 = { icon: cur, color: color };
    const ctl = overlay(`<h2>Icon and colour</h2>
      <div style="display:flex;gap:14px;align-items:center;margin-bottom:12px"><span class="ico big" id="ip-prev"></span>
        <label class="f" style="margin:0">Own emoji or text <input id="ip-txt" style="width:120px;margin-left:6px" maxlength="8"></label>
        <label class="f" style="margin:0">Colour <input type="color" id="ip-col" style="margin-left:6px"></label></div>
      <div class="emogrid">${EMO.map(e => `<button class="emo" data-e="${e}">${e}</button>`).join('')}</div>
      <div class="m-btns"><button data-ip="reset" class="ghost">Use type icon</button><span style="flex:1"></span><button data-ip="cancel">Cancel</button><button class="primary" data-ip="ok">Apply</button></div>`, 'wide'), wrap = ctl.wrap;
    const prev = $('#ip-prev', wrap), txt = $('#ip-txt', wrap), col = $('#ip-col', wrap);
    const draw = () => { prev.textContent = state2.icon || fallback.icon; prev.style.setProperty('--c', state2.color || fallback.color); $$('.emo', wrap).forEach(b => b.classList.toggle('on', b.dataset.e === state2.icon)); };
    txt.value = state2.icon; col.value = /^#[0-9a-f]{6}$/i.test(state2.color || fallback.color) ? (state2.color || fallback.color) : '#8b8d98';
    const close = v => ctl.close(v); ctl.onClose = resolve;
    ctl.onKey = e => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); close(state2); } };
    wrap.addEventListener('click', e => {
      const em = e.target.closest('[data-e]'); if (em) { state2.icon = em.dataset.e; txt.value = state2.icon; draw(); return; }
      const b = e.target.closest('[data-ip]'); if (!b) return;
      if (b.dataset.ip === 'ok') close(state2); else if (b.dataset.ip === 'cancel') close(null); else close({ icon: '', color: '' });
    });
    txt.addEventListener('input', () => { state2.icon = txt.value.trim(); draw(); });
    col.addEventListener('input', () => { state2.color = col.value; draw(); });
    draw();
  });
}
const REF_TARGETS = () => Object.values(state.templates).sort((a, b) => a.name.localeCompare(b.name));
async function addFieldDialog(existing) {
  const r = await modal({ title: 'Add field', wide: true, body: `
    <div style="display:grid;grid-template-columns:1fr 200px;gap:10px"><div><label class="f">Name</label><input name="label" placeholder="e.g. Warranty until"></div>
      <div><label class="f">Type</label><select name="type">${FIELD_TYPES.map(t => `<option value="${t}">${FIELD_TYPE_LABELS[t]}</option>`).join('')}</select></div></div>
    <div id="af-opt" style="display:none"><label class="f">Options (comma-separated)</label><input name="options" placeholder="Active, Spare, Retired"></div>
    <div id="af-ref" style="display:none;grid-template-columns:1fr 1fr auto;gap:10px;align-items:end">
      <div><label class="f">Relation type</label><select name="relation">${Object.values(state.relTypes).map(r => `<option value="${esc(r.key)}">${esc(r.label)}</option>`).join('')}</select></div>
      <div><label class="f">Links to</label><select name="target"><option value="">any type</option>${REF_TARGETS().map(t => `<option value="${esc(t.key)}">${esc(t.icon)} ${esc(t.name)}</option>`).join('')}</select></div>
      <label class="chk" style="padding-bottom:8px"><input type="checkbox" name="multiple" checked> several</label></div>
    <p class="note">The field is added to this object only. To add it to every object of a type, add it to the template in Settings.</p><div class="m-err msg err"></div>`,
    buttons: [{ label: 'Cancel' }, { label: 'Add field', value: 'ok', primary: true, validate: v => !v.label.trim() ? 'Name is required' : existing.some(x => lc(x) === lc(v.label)) ? 'This object already has a field with that name' : (v.type === 'ref' && !v.relation ? 'Choose a relation type' : '') }],
    onOpen: w => $('[name=type]', w).addEventListener('change', e => { $('#af-opt', w).style.display = e.target.value === 'select' ? '' : 'none'; $('#af-ref', w).style.display = e.target.value === 'ref' ? 'grid' : 'none'; }) });
  if (!r) return null;
  return normFieldDefs([{ label: r.label.trim(), type: r.type, options: r.options ? r.options.split(',').map(s => s.trim()).filter(Boolean) : [], relation: r.relation, target: r.target, multiple: r.multiple }])[0];
}

async function addRelations(anchor, type, tpl) {
  const d = state.draft;
  const have = d.relations.filter(r => r.type === type).map(r => r.target);
  let ids = await openPicker({ anchor, tpl, exclude: [...(d.isNew ? [] : [d.id]), ...have], title: relOf(type).label, multi: true });
  if (!ids || !ids.length) { if (ids && !have.length) { d.relGroups = [...new Set([...(d.relGroups || []), type])]; renderEditKeep(); } return; }
  for (const id of ids) d.relations.push({ type, target: id });
  d.relGroups = (d.relGroups || []).filter(x => x !== type);
  d.dirty = true; renderEditKeep();
  const A = assignRefs(d.relations, d.template, d.customFields);
  const caught = ids.filter(id => !A.rest.some(r => r.target === id && r.type === type));
  if (caught.length) toast(`${caught.length} added to the matching field above`);
}

function chipInner(id) {
  const o = state.objects.get(id);
  return o ? `${objIcon(o, 'xs')}<span>${esc(o.name)}</span><span class="dim mono" style="font-size:11px">${esc(id)}</span>` : `<span class="msg err">⚠ ${esc(id)} not found</span>`;
}
function onEditInput(e) {
  const t = e.target, d = state.draft; if (!d || !t.dataset.bind) return;
  d.dirty = true; const i = +t.dataset.i;
  switch (t.dataset.bind) {
    case 'name': d.name = t.value; if (t.value.trim()) { const m = $('.msg[data-msg="__name"]'); if (m) { m.textContent = ''; m.className = 'msg'; } } break;
    case 'notes': d.notes = t.value; break;
    case 'folder': d.folder = t.value; break;
    case 'template': if (e.type === 'change') switchTemplate(d, t.value); break;
    case 'field': d.fields[t.dataset.key] = t.type === 'checkbox' ? (t.checked ? 'true' : 'false') : t.value; break;
    case 'group-type': if (e.type === 'change') {
      const from = t.dataset.type, to = t.value; if (from === to) break;
      const A2 = assignRefs(d.relations, d.template, d.customFields), idx = new Set(A2.rest.filter(r => r.type === from).map(r => r.i));
      d.relations.forEach((r, j) => { if (idx.has(j)) r.type = to; });
      d.relations = d.relations.filter((r, j, all) => all.findIndex(x => x.type === r.type && x.target === r.target) === j);
      d.relGroups = (d.relGroups || []).filter(x => x !== from); if (!idx.size && !d.relGroups.includes(to)) d.relGroups.push(to);
      renderEditKeep(); } break;
  }
  if (t.classList.contains('reset')) t.classList.remove('reset');
}
function onEditChange(e) {
  const t = e.target, d = state.draft; if (!d) return;
  if (t.dataset.bind === 'field' || t.dataset.bind === 'name') showMessages(validateDraft(d), t.dataset.bind === 'name' ? '__name' : t.dataset.key);
}
function findDup(label, v, exceptId) {
  const n = lc(v); if (!n) return [];
  return [...state.objects.values()].filter(o => o.id !== exceptId && lc(o.fields[label]) === n && (tplOf(o)?.fields || []).some(f => f.label === label && f.unique));
}
function validateDraft(d) {
  const errs = [], warns = [], tpl = state.templates[d.template];
  if (!d.name.trim()) errs.push({ key: '__name', msg: 'Name is required' });
  for (const f of tpl?.fields || []) {
    const v = String(d.fields[f.label] ?? '').trim();
    if (f.required && !v) errs.push({ key: f.label, msg: 'Required' });
    if (v && f.type === 'ip' && !v.split(/[,;\s]+/).filter(Boolean).every(isIP)) warns.push({ key: f.label, msg: 'Does not look like an IPv4 address', soft: true });
    if (f.type === 'ref') { if (f.required && !(assignRefs(d.relations, d.template, d.customFields).byField.get(f.label) || []).length) errs.push({ key: f.label, msg: 'Required' }); continue; }
    if (v && f.unique) {
      const dups = findDup(f.label, v, d.isNew ? null : d.id);
      if (dups.length) (f.unique === 'strict' ? errs : warns).push({ key: f.label, msg: `${f.unique === 'strict' ? 'Must be unique. ' : ''}Already used by: ${dups.map(x => x.name + ' (' + x.id + ')').join(', ')}`, dup: true });
    }
  }
  d.relations.forEach((r, i) => {
    if (!r.target) return;
    if (!state.objects.has(r.target)) errs.push({ key: 'rel' + i, msg: `Linked object "${r.target}" not found` });
    else if (!d.isNew && r.target === d.id) errs.push({ key: 'rel' + i, msg: `An object cannot link to itself` });
  });
  return { errs, warns };
}
function showMessages({ errs, warns }, onlyKey) {
  $$('.edit .msg[data-msg]').forEach(m => { if (!onlyKey || m.dataset.msg === onlyKey) { m.textContent = ''; m.className = 'msg'; } });
  for (const [list, cls] of [[warns, 'warn'], [errs, 'err']]) for (const x of list) {
    if (onlyKey && x.key !== onlyKey) continue;
    const m = $(`.msg[data-msg="${CSS.escape(x.key)}"]`); if (m) { m.textContent = x.msg; m.className = 'msg ' + cls; }
  }
}

async function saveDraft() {
  const d = state.draft; if (!d) return;
  d.relations = d.relations.filter(r => r.target); d.validated = true;
  const v = validateDraft(d); showMessages(v);
  if (v.errs.length) { toast('Cannot save: ' + esc(v.errs.map(e => e.msg).join('; ')), 'err'); renderEditKeep(); return; }
  const dupWarns = v.warns.filter(w => w.dup);
  if (dupWarns.length && !await confirmBox('Duplicate values', `<ul>${dupWarns.map(w => `<li><b>${esc(w.key)}</b>: ${esc(w.msg)}</li>`).join('')}</ul>Save anyway?`, 'Save anyway')) return;
  const tpl = state.templates[d.template]; const now = nowStamp();
  const seen = new Set(); const relations = [];
  for (const r of d.relations) { const k = r.type + '>' + r.target; if (!seen.has(k)) { seen.add(k); relations.push({ type: r.type, target: r.target }); } }
  const fields = {}; for (const [k, val] of Object.entries(d.fields)) fields[k] = String(val ?? '').trim() === '' ? '' : String(val).replace(/\s+$/, '');
  const o = { id: d.isNew ? '' : d.id, name: d.name.trim(), template: d.template, icon: d.icon || '', color: d.color || '', customFields: d.customFields || [], tags: d.tags, created: d.created || now, updated: now, fields, relations, notes: d.notes || '', extra: d.extra || {}, folder: d.folder };
  try {
    let r;
    if (d.isNew) {
      for (let attempt = 0; attempt < 5; attempt++) { o.id = await nextId(tpl?.prefix || CUSTOM_PREFIX, [], o.folder); r = await persist(o, null); if (!r.conflict) break; }
      if (r.conflict) { toast('Could not allocate a free id, reload and try again', 'err'); return; }
    } else {
      r = await persistUI(o, state.objects.get(d.id));
      if (!r.ok) return;
    }
    state.mode = 'view'; state.draft = null; state.selectedId = o.id; rebuildIndex(); render();
    toast(`${d.isNew ? 'Created' : 'Saved'} <b>${esc(o.name)}</b> <span class="mono">${esc(o.id)}</span>`, 'ok');
  } catch (e) { console.error(e); toast('Save failed: ' + esc(e.message), 'err'); }
}
function renderEditKeep() { const sc = $('#detail').scrollTop; renderDetail(); $('#detail').scrollTop = sc; if (state.draft?.validated) showMessages(validateDraft(state.draft)); }

async function cancelEdit() {
  if (state.draft?.dirty && !await confirmBox('Discard changes?', 'Your unsaved changes will be lost.', 'Discard', true)) return;
  state.mode = 'view'; state.draft = null; render();
}

/* ---------- create / duplicate / delete ---------- */
async function newObject() {
  const curFolder = state.filter.kind === 'folder' ? state.filter.value : '';
  const folderFor = k => [...state.folders].find(([, c]) => c.default_template === k)?.[0];
  const def = state.folders.get(curFolder)?.default_template;
  if (curFolder && def && state.templates[def]) return startEdit(newDraft(def, curFolder));
  if (state.filter.kind === 'template' && state.templates[state.filter.value]) return startEdit(newDraft(state.filter.value, folderFor(state.filter.value) ?? ''));
  const key = await chooseType();
  if (key == null) return;
  startEdit(newDraft(key, curFolder || (key ? folderFor(key) : '') || ''));
}
function chooseType() {
  return new Promise(resolve => {
    const count = {}; for (const o of state.objects.values()) count[o.template] = (count[o.template] || 0) + 1;
    const tpls = Object.values(state.templates).sort((a, b) => (count[b.key] || 0) - (count[a.key] || 0) || a.name.localeCompare(b.name));
    const ctl = overlay(`<button class="ghost sm gclose" data-g="x">✕</button>
      <h2>What would you like to add?</h2>
      <div class="gsearch"><input placeholder="Search a type…" autocomplete="off"></div>
      <div class="tiles"></div>
      <button class="tile wide" data-g=""><span class="ico" style="--c:#8b7cff">✳️</span><span><b>Custom object</b><small>Start empty: choose your own icon, name and fields</small></span></button>
      <div class="gfoot"><a data-g="tpl">⚙ Manage templates</a></div>`, 'gallery'), wrap = ctl.wrap;
    const tiles = $('.tiles', wrap), q = $('input', wrap); let sel = 0, shown = [];
    const draw = () => {
      const s = lc(q.value); shown = tpls.filter(t => !s || lc(t.name).includes(s) || lc(t.key).includes(s));
      sel = Math.min(sel, Math.max(0, shown.length - 1));
      tiles.innerHTML = shown.map((t, i) => `<button class="tile ${i === sel ? 'on' : ''}" data-g="${esc(t.key)}"><span class="ico" style="--c:${esc(t.color)}">${esc(t.icon)}</span><span><b>${esc(t.name)}</b><small>${count[t.key] || 0} object${count[t.key] === 1 ? '' : 's'}</small></span></button>`).join('') || '<div class="empty" style="grid-column:1/-1">No matching type, use Custom object</div>';
    };
    const close = v => ctl.close(v); ctl.onClose = resolve;
    ctl.onKey = e => {
      if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); close(shown[sel] ? shown[sel].key : ''); }
      else if (['ArrowRight', 'ArrowDown'].includes(e.key)) { e.preventDefault(); sel = Math.min(shown.length - 1, sel + (e.key === 'ArrowDown' ? 3 : 1)); draw(); }
      else if (['ArrowLeft', 'ArrowUp'].includes(e.key)) { e.preventDefault(); sel = Math.max(0, sel - (e.key === 'ArrowUp' ? 3 : 1)); draw(); }
    };
    wrap.addEventListener('click', e => {
      const b = e.target.closest('[data-g]'); if (!b) return;
      if (b.dataset.g === 'x') close(null);
      else if (b.dataset.g === 'tpl') { close(null); state.view = 'settings'; state.settingsSel = { kind: 'rel' }; render(); }
      else close(b.dataset.g);
    });
    q.addEventListener('input', () => { sel = 0; draw(); });
    draw(); q.focus();
  });
}
async function duplicateObject(o) {
  const tpl = tplOf(o); const resetF = fieldDefs(o).filter(f => f.reset_on_copy).map(f => f.label);
  const r = await modal({ title: `Duplicate “${o.name}”`, body: `<label class="chk"><input type="checkbox" name="rels" checked> Copy relations (${o.relations.length})</label><br>
      <label class="chk" style="margin-top:8px"><input type="checkbox" name="notes" ${o.notes ? 'checked' : ''}> Copy notes</label>
      ${resetF.length ? `<p class="note">These fields will be cleared and highlighted: <b>${resetF.map(esc).join(', ')}</b>. The name gets the next free number.</p>` : ''}`,
    buttons: [{ label: 'Cancel' }, { label: 'Duplicate', value: 'ok', primary: true }] });
  if (!r) return;
  const d = makeDraft(o); d.isNew = true; d.id = ''; d.origId = null; delete d.created; delete d.updated;
  d.name = incName(o.name, allNames()); d.reset = ['__name', ...resetF];
  if (!r.rels) d.relations = []; if (!r.notes) d.notes = '';
  dropResetRefs(d, tpl); resetF.forEach(l => { if (l in d.fields) d.fields[l] = ''; });
  d.dirty = true; startEdit(d);
}


function dropResetRefs(d, tpl) {
  const A = assignRefs(d.relations, d.template, d.customFields); const drop = new Set();
  for (const f of [...(tpl?.fields || []), ...(d.customFields || [])]) if (f.type === 'ref' && f.reset_on_copy) (A.byField.get(f.label) || []).forEach(r => drop.add(r.i));
  d.relations = d.relations.filter((_, i) => !drop.has(i));
}
async function createMultiple(o) {
  const tpl = tplOf(o); const resetF = (tpl?.fields || []).filter(f => f.reset_on_copy).map(f => f.label);
  const preview = n => { const t = allNames(); const a = []; for (let i = 0; i < Math.min(n, 50); i++) a.push(incName(o.name, t)); return a; };
  const r = await modal({ title: `Create multiple copies of “${o.name}”`, wide: true,
    body: `<label class="f">How many</label><input type="number" name="n" value="3" min="1" max="50" style="width:120px">
      <label class="f">Names</label><div id="mprev" class="mono" style="color:var(--muted)"></div>
      <div style="margin-top:12px"><label class="chk"><input type="checkbox" name="rels" checked> Copy relations (${o.relations.length})</label>
      <label class="chk" style="margin-left:16px"><input type="checkbox" name="notes"> Copy notes</label></div>
      ${resetF.length ? `<p class="note">Cleared in the copies: <b>${resetF.map(esc).join(', ')}</b>. Everything else is copied from ${esc(o.name)}.</p>` : ''}<div class="m-err msg err"></div>`,
    buttons: [{ label: 'Cancel' }, { label: 'Create', value: 'ok', primary: true, validate: v => (+v.n >= 1 && +v.n <= 50) ? '' : 'Enter 1–50' }],
    onOpen: w => { const upd = () => { const n = +$('[name=n]', w).value || 0; const p = preview(Math.max(0, Math.min(n, 50))); $('#mprev', w).textContent = p.length ? (p.length > 6 ? p.slice(0, 3).join(', ') + ' … ' + p.slice(-2).join(', ') : p.join(', ')) : '—'; }; $('[name=n]', w).addEventListener('input', upd); upd(); } });
  if (!r) return;
  const names = preview(+r.n); const now = nowStamp(); let made = 0; const ids = [];
  try {
    let id = await nextId(tpl?.prefix || CUSTOM_PREFIX, [], o.folder);
    for (const name of names) {
      const fields = { ...o.fields }; resetF.forEach(l => fields[l] = '');
      const c = { id, name, template: o.template, icon: o.icon || '', color: o.color || '', customFields: clone(o.customFields || []), tags: [...o.tags], created: now, updated: now, fields, relations: r.rels ? clone(o.relations) : [], notes: r.notes ? o.notes : '', extra: clone(o.extra || {}), folder: o.folder };
      dropResetRefs(c, tpl); for (const l of resetF) if (!(l in o.fields)) delete c.fields[l];
      let res = await persist(c, null);
      while (res.conflict === 'exists') { c.id = await nextId(tpl?.prefix || CUSTOM_PREFIX, [...ids, id], o.folder); res = await persist(c, null); }
      ids.push(c.id); made++;
      const m = c.id.match(/-(\d+)$/); id = `${tpl?.prefix || CUSTOM_PREFIX}-${String(+m[1] + 1).padStart(4, '0')}`;
    }
  } catch (e) { toast('Error: ' + esc(e.message), 'err'); }
  rebuildIndex(); state.selectedId = ids[0] || state.selectedId; render();
  toast(`Created ${made} object(s): ${esc(names.slice(0, made).join(', '))}`, 'ok');
}

async function deleteObject(o) {
  const refs = [...new Set((state.inbound.get(o.id) || []).map(r => r.from))].map(id => state.objects.get(id)).filter(Boolean);
  const r = await modal({ title: `Delete “${o.name}”?`, body: `The file is removed; a copy is kept in <span class="mono">_history/${esc(o.id)}/</span>.
      ${refs.length ? `<p>${refs.length} object(s) link to it:</p><ul>${refs.map(x => `<li>${esc(x.name)} <span class="dim">${esc(x.id)}</span></li>`).join('')}</ul>
      <label class="chk"><input type="checkbox" name="clean" checked> Also remove these links</label>` : ''}`,
    buttons: [{ label: 'Cancel' }, { label: 'Delete', value: 'ok', danger: true }] });
  if (!r) return;
  try {
    const p = objPath(o); const mt = await state.fs.mtime(p);
    if (mt !== null) { await writeHistory(o.id, (await state.fs.read(p)).text, '_deleted'); await state.fs.remove(p); }
    state.objects.delete(o.id); (state.usedIds ||= new Set()).add(o.id);
    let skipped = 0;
    if (r.clean) for (const x of refs) {
      const c = clone({ ...x, mtime: undefined }); c.relations = c.relations.filter(rr => rr.target !== o.id); c.updated = nowStamp();
      const res = await persist(c, x); if (!res.ok) skipped++;
    }
    state.selectedId = null; rebuildIndex(); render();
    toast(`Deleted <b>${esc(o.name)}</b>${skipped ? ` (${skipped} linked object(s) changed on disk, not updated)` : ''}`, skipped ? 'warn' : 'ok');
  } catch (e) { toast('Delete failed: ' + esc(e.message), 'err'); }
}

/* ---------- history ---------- */
async function renderHistory(o) {
  const box = $('#tabbody'); if (!box) return;
  let entries = (await state.fs.list(['_history', o.id])).filter(e => e.kind === 'file' && /\.md$/i.test(e.name)).map(e => e.name).sort().reverse();
  if (state.selectedId !== o.id || state.tab !== 'history') return;
  if (!entries.length) { box.innerHTML = '<div class="card dim">No previous versions yet. A version is stored every time the object is saved.</div>'; return; }
  if (!entries.includes(state.histSel)) state.histSel = entries[0];
  const saved = await Promise.all(entries.map(async n => { try { return parseMd((await state.fs.read(['_history', o.id, n])).text).fm.updated || ''; } catch (e) { return ''; } }));
  if (state.selectedId !== o.id || state.tab !== 'history') return;
  box.innerHTML = `<div class="hist"><div class="card hlist" style="padding:6px">
      <div class="hi" style="cursor:default"><b>Current version</b><small>saved ${esc(fmtStamp(o.updated))}</small></div>
      ${entries.map((n, i) => `<div class="hi ${n === state.histSel ? 'on' : ''}" data-act="hist-open" data-file="${esc(n)}">Version of ${esc(fmtStamp(saved[i]) || '?')}${/_deleted/.test(n) ? ' <span class="msg err">deleted</span>' : ''}<small>replaced ${esc(fmtStamp(n.replace(/\.md$/, '')))}</small></div>`).join('')}
    </div><div class="card" id="hdiff"><div class="dim">Loading…</div></div></div>`;
  const sel = state.histSel;
  try {
    const old = toObj(...Object.values(parseMd((await state.fs.read(['_history', o.id, sel])).text)));
    $('#hdiff').innerHTML = `<h3>Version of ${esc(fmtStamp(old.updated) || '?')} <span class="sp"></span><button class="sm" data-act="hist-restore" data-file="${esc(sel)}">Restore this version</button></h3>${diffHtml(old, o)}`;
  } catch (e) { $('#hdiff').innerHTML = `<div class="msg err">${esc(e.message)}</div>`; }
}
function diffHtml(a, b) {
  const rows = [];
  const add = (label, x, y, mono) => rows.push(`<tr class="${x !== y ? 'ch' : ''}"><th>${esc(label)}</th><td class="${x !== y ? 'old' : ''} ${mono ? 'mono' : ''}">${esc(x) || '<span class="dim">—</span>'}</td><td class="${x !== y ? 'new' : ''}">${esc(y) || '<span class="dim">—</span>'}</td></tr>`);
  add('Name', a.name, b.name); add('Tags', a.tags.join(', '), b.tags.join(', '));
  const keys = [...new Set([...Object.keys(a.fields), ...Object.keys(b.fields)])];
  keys.forEach(k => add(k, a.fields[k] || '', b.fields[k] || ''));
  const rs = o => o.relations.map(r => `${relOf(r.type).label} → ${state.objects.get(r.target)?.name || r.target}`).sort().join('\n');
  add('Relations', rs(a), rs(b)); add('Notes', a.notes, b.notes);
  const changed = rows.filter(r => r.startsWith('<tr class="ch"')).length;
  return `<p class="muted" style="margin-top:0">${changed} difference(s) compared with the current version.</p>
    <table class="diff"><tr><th></th><th>That version</th><th>Current</th></tr>${rows.join('')}</table>`;
}
async function restoreVersion(o, file) {
  if (!await confirmBox('Restore version?', `The current version of <b>${esc(o.name)}</b> is saved to history first, then replaced with the version from ${esc(fmtStamp(file.replace(/\.md$/, '')))}.`, 'Restore')) return;
  const old = toObj(...Object.values(parseMd((await state.fs.read(['_history', o.id, file])).text)));
  const n = { ...old, id: o.id, template: o.template, folder: o.folder, created: o.created, updated: nowStamp() };
  const r = await persistUI(n, o); if (!r.ok) return;
  state.tab = 'details'; rebuildIndex(); render(); toast('Version restored', 'ok');
}
