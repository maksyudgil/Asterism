/* ================= settings ================= */
function renderSettings() {
  if (!state.settingsSel) state.settingsSel = { kind: 'rel' };
  const s = state.settingsSel; const tcount = {}; for (const o of state.objects.values()) tcount[o.template] = (tcount[o.template] || 0) + 1;
  $('#main').innerHTML = `<section class="settings"><nav class="snav">
      <div class="side" style="width:auto;border:0;background:none;padding:0">
      <div class="sec">General</div>
      <div class="item ${s.kind === 'rel' ? 'on' : ''}" data-act="set-sel" data-kind="rel"><span>🔗</span>Relation types<span class="cnt">${Object.keys(state.relTypes).length}</span></div>
      <div class="sec">Templates <button class="ghost" data-act="tpl-new" title="New template">+</button></div>
      ${Object.values(state.templates).sort((a, b) => a.name.localeCompare(b.name)).map(t => `<div class="item ${s.kind === 'tpl' && s.key === t.key ? 'on' : ''}" data-act="set-sel" data-kind="tpl" data-key="${esc(t.key)}"><span class="ico xs" style="--c:${esc(t.color)}">${esc(t.icon)}</span>${esc(t.name)}<span class="cnt">${tcount[t.key] || 0}</span></div>`).join('')}
      </div></nav><div class="sbody" id="sbody"></div></section>`;
  if (s.kind === 'tpl') renderTplEditor(); else renderRelEditor();
}

function applyAppearance() {
  document.body.classList.toggle('solid', !!prefs.solid); document.body.classList.toggle('nomotion', !!prefs.nomotion);
  const sys = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const set = (id, on, label, tip) => { const b = $(id); if (!b) return; b.classList.toggle('off', !on); b.setAttribute('aria-pressed', on); b.title = `${label}: ${on ? 'on' : 'off'}. ${tip}`; };
  set('#fx-glass', !prefs.solid, 'Glass effect', 'Click to switch. Turn off if the app feels slow.');
  set('#fx-motion', !prefs.nomotion && !sys, 'Animations', sys ? 'Turned off by the Windows setting "Show animations".' : 'Click to switch.');
}
function renderRelEditor() {
  const used = {}; for (const o of state.objects.values()) for (const r of o.relations) used[r.type] = (used[r.type] || 0) + 1;
  if (!state.relDraft) state.relDraft = Object.values(state.relTypes).map(r => ({ ...r, orig: r.key }));
  const rows = state.relDraft;
  $('#sbody').innerHTML = `<h2>Relation types</h2>
    <p class="lead">Presets for links between objects. <b>Label</b> is shown on the object that has the link, <b>inverse</b> on the object it points to (e.g. AP “Connected to” switch, switch shows “Connected devices”). Labels and colours can be changed at any time; the key is stored in object files, so it cannot be changed once used.</p>
    <table class="tbl"><tr><th>Key</th><th>Label (outgoing)</th><th>Inverse (incoming)</th><th>Colour</th><th>Category</th><th>Used</th><th></th></tr>
    ${rows.map((r, i) => `<tr><td><input data-rb="key" data-i="${i}" value="${esc(r.key)}" class="mono" ${used[r.orig] ? 'disabled title="In use"' : ''}></td>
      <td><input data-rb="label" data-i="${i}" value="${esc(r.label)}"></td><td><input data-rb="inverse" data-i="${i}" value="${esc(r.inverse)}"></td>
      <td><input type="color" data-rb="color" data-i="${i}" value="${esc(/^#[0-9a-f]{6}$/i.test(r.color) ? r.color : '#8b8d98')}"></td>
      <td><input data-rb="category" data-i="${i}" value="${esc(r.category)}" list="dl-relcat"></td><td class="c dim">${used[r.orig] || 0}</td>
      <td><button class="ghost sm" data-act="rel-rm" data-i="${i}" ${used[r.orig] ? 'disabled title="In use"' : ''}>✕</button></td></tr>`).join('')}</table>
    <datalist id="dl-relcat">${['Technical', 'Dependency', 'Reference', 'Link', 'Financial'].map(c => `<option value="${c}">`).join('')}</datalist>
    <div style="margin-top:12px;display:flex;gap:8px"><button class="sm" data-act="rel-add">+ Add relation type</button><span class="sp" style="flex:1"></span><button data-act="rel-reset">Revert</button><button class="primary" data-act="rel-save">Save relation types</button></div>
    <div class="msg err" id="relerr" style="margin-top:8px"></div>`;
}
async function saveRelTypes() {
  const rows = state.relDraft, keys = new Set(), out = {};
  for (const r of rows) {
    r.key = r.key.trim(); r.label = r.label.trim();
    if (!/^[a-z0-9_]+$/.test(r.key)) return $('#relerr').textContent = `Key "${r.key}" must be lowercase letters, digits or _`;
    if (keys.has(r.key)) return $('#relerr').textContent = `Duplicate key "${r.key}"`;
    if (!r.label) return $('#relerr').textContent = `Label is required for "${r.key}"`;
    keys.add(r.key); out[r.key] = { key: r.key, label: r.label, inverse: r.inverse.trim() || '← ' + r.label, color: r.color, category: r.category.trim() };
  }
  try { await state.fs.write(['_relations.yaml'], dumpRelTypes(out)); state.relTypes = out; state.relDraft = null; rebuildIndex(); render(); toast('Relation types saved', 'ok'); }
  catch (e) { toast('Save failed: ' + esc(e.message), 'err'); }
}

function renderTplEditor() {
  const s = state.settingsSel; const t = state.tplDraft;
  if (!t) { $('#sbody').innerHTML = ''; return; }
  const inUse = [...state.objects.values()].filter(o => o.template === t.origKey).length;
  const relOpts = sel => `<option value=""></option>` + Object.values(state.relTypes).map(r => `<option value="${esc(r.key)}" ${r.key === sel ? 'selected' : ''}>${esc(r.label)}</option>`).join('');
  const tplOpts = sel => `<option value="">any type</option>` + Object.values(state.templates).map(x => `<option value="${esc(x.key)}" ${x.key === sel ? 'selected' : ''}>${esc(x.name)}</option>`).join('') + (t.isNew && t.key ? `<option value="${esc(t.key)}" ${t.key === sel ? 'selected' : ''}>${esc(t.name || t.key)} (this)</option>` : '');
  $('#sbody').innerHTML = `<h2>${t.isNew ? 'New template' : esc(t.name)}</h2>
    <p class="lead">${t.isNew ? 'A template defines the id prefix, icon, default fields and suggested relations of a type of object.' : `${inUse} object(s) use this template. Fields can be added, removed, reordered or renamed at any time: renaming moves the values in all objects; removing a field keeps existing values in the objects as custom fields.`}</p>
    <div class="formgrid">
      <label>Name<input data-tb="name" value="${esc(t.name)}"></label>
      <label>Key (file name)<input data-tb="key" value="${esc(t.key)}" class="mono" ${t.isNew ? '' : 'disabled title="Stored in object files"'}></label>
      <label>Id prefix<input data-tb="prefix" value="${esc(t.prefix)}" class="mono" ${inUse ? 'disabled title="Objects already use this prefix"' : ''}></label>
      <label>Icon / colour<span style="display:flex;gap:6px"><button class="ico icobtn" style="--c:${esc(t.color)};width:34px;height:32px" data-act="tpl-icon" title="Choose icon">${esc(t.icon)}</button><input data-tb="icon" value="${esc(t.icon)}" style="width:60px;text-align:center"><input type="color" data-tb="color" value="${esc(/^#[0-9a-f]{6}$/i.test(t.color) ? t.color : '#8b8d98')}"></span></label>
    </div>
    <div class="card"><h3>Fields</h3><table class="tbl"><tr><th style="width:22%">Label</th><th style="width:150px">Type</th><th>Options / reference</th><th class="c" style="width:70px">Required</th><th style="width:96px">Unique</th><th class="c" title="Cleared when an object is duplicated">Reset on copy</th><th></th></tr>
      ${t.fields.map((f, i) => `<tr><td><input data-fb="label" data-i="${i}" value="${esc(f.label)}">${f.orig && f.orig !== f.label ? `<div class="msg warn" style="font-size:11px">rename from “${esc(f.orig)}”</div>` : ''}</td>
        <td><select data-fb="type" data-i="${i}">${FIELD_TYPES.map(x => `<option value="${x}" ${x === f.type ? 'selected' : ''}>${FIELD_TYPE_LABELS[x]}</option>`).join('')}</select></td>
        <td>${f.type === 'ref' ? `<div class="refcfg"><select data-fb="relation" data-i="${i}" title="Relation type">${Object.values(state.relTypes).map(r => `<option value="${esc(r.key)}" ${r.key === f.relation ? 'selected' : ''}>${esc(r.label)}</option>`).join('')}</select>
            <select data-fb="target" data-i="${i}" title="Allowed object type">${tplOpts(f.target)}</select>
            <label class="chk" title="Allow several objects"><input type="checkbox" data-fb="multiple" data-i="${i}" ${f.multiple ? 'checked' : ''}> many</label></div>`
          : `<input data-fb="options" data-i="${i}" value="${esc(f.options.join(', '))}" ${f.type === 'select' ? '' : 'disabled'}>`}</td>
        <td class="c"><input type="checkbox" data-fb="required" data-i="${i}" ${f.required ? 'checked' : ''}></td>
        <td>${f.type === 'ref' ? '' : `<select data-fb="unique" data-i="${i}"><option value="">—</option><option value="warn" ${f.unique === 'warn' ? 'selected' : ''}>warn</option><option value="strict" ${f.unique === 'strict' ? 'selected' : ''}>strict</option></select>`}</td>
        <td class="c"><input type="checkbox" data-fb="reset_on_copy" data-i="${i}" ${f.reset_on_copy ? 'checked' : ''}></td>
        <td style="white-space:nowrap"><button class="ghost sm" data-act="tpl-up" data-i="${i}" ${i ? '' : 'disabled'}>↑</button><button class="ghost sm" data-act="tpl-down" data-i="${i}" ${i < t.fields.length - 1 ? '' : 'disabled'}>↓</button><button class="ghost sm" data-act="tpl-rm-field" data-i="${i}">✕</button></td></tr>`).join('')}
      </table><button class="sm" style="margin-top:10px" data-act="tpl-add-field">+ Add field</button>
      <p class="note"><b>Reference</b> fields link to other objects (e.g. Business owner → Person). They are stored as relations, so they also appear in the graph and on the linked object.<br><b>Unique</b>: <i>warn</i> shows a warning (with a link to the other object) but saves; <i>strict</i> blocks saving. <b>Reset on copy</b>: cleared and highlighted when duplicating.</p></div>
    <div class="card"><h3>Suggested relations</h3><p class="note" style="margin-top:0">Shown as quick buttons when editing an object of this type. Any other relation can still be added.</p>
      <table class="tbl"><tr><th>Relation type</th><th>Target type</th><th></th></tr>
      ${t.relations.map((r, i) => `<tr><td><select data-sb="type" data-i="${i}">${relOpts(r.type)}</select></td><td><select data-sb="target" data-i="${i}">${tplOpts(r.target)}</select></td><td><button class="ghost sm" data-act="tpl-rm-rel" data-i="${i}">✕</button></td></tr>`).join('')}</table>
      <button class="sm" style="margin-top:10px" data-act="tpl-add-rel">+ Add suggestion</button></div>
    <div style="display:flex;gap:8px;align-items:center">${!t.isNew ? `<button class="danger" data-act="tpl-delete" ${inUse ? `disabled title="${inUse} object(s) use it"` : ''}>Delete template</button>` : ''}<span style="flex:1"></span>
      <button data-act="tpl-revert">Revert</button><button class="primary" data-act="tpl-save">Save template</button></div>
    <div class="msg err" id="tplerr" style="margin-top:8px"></div>`;
}
function selectTemplate(key) {
  const t = state.templates[key];
  state.settingsSel = { kind: 'tpl', key }; state.tplDraft = { ...clone(t), origKey: key, isNew: false, fields: t.fields.map(f => ({ ...clone(f), orig: f.label })) };
}
async function saveTemplate() {
  const t = state.tplDraft, err = m => { $('#tplerr').textContent = m; };
  t.name = t.name.trim(); t.key = t.key.trim(); t.prefix = t.prefix.trim().toLowerCase();
  if (!t.name) return err('Name is required');
  if (!/^[a-z0-9-]+$/.test(t.key)) return err('Key: lowercase letters, digits and - only');
  if (t.isNew && state.templates[t.key]) return err(`Template "${t.key}" already exists`);
  if (!/^[a-z0-9]+$/.test(t.prefix)) return err('Prefix: lowercase letters and digits only');
  const other = Object.values(state.templates).find(x => x.prefix === t.prefix && x.key !== t.origKey);
  if (other) return err(`Prefix "${t.prefix}" is already used by ${other.name}`);
  const labels = new Set();
  for (const f of t.fields) { f.label = f.label.trim(); if (!f.label) return err('Every field needs a label'); if (labels.has(lc(f.label))) return err(`Duplicate field "${f.label}"`); labels.add(lc(f.label)); }
  t.relations = t.relations.filter(r => r.type);
  for (const f of t.fields) if (f.type === 'ref' && !f.relation) return err(`Reference field "${f.label}" needs a relation type`);
  const renames = t.isNew ? [] : t.fields.filter(f => f.type !== 'ref' && f.orig && f.orig !== f.label).map(f => [f.orig, f.label]);
  const oldT = t.isNew ? null : state.templates[t.origKey];
  const kept = new Set(t.fields.map(f => f.orig).filter(Boolean));
  const removed = (oldT?.fields || []).filter(f => !kept.has(f.label));
  const newLabels = new Set(t.fields.map(f => f.label));
  const added = t.fields.filter(f => !f.orig).map(f => f.label);
  const objsOf = t.isNew ? [] : [...state.objects.values()].filter(o => o.template === t.key);
  const affected = objsOf.filter(o => removed.length || renames.some(([a]) => a in o.fields) || (o.customFields || []).some(f => newLabels.has(f.label)));
  if (objsOf.length && (renames.length || removed.length || added.length)) {
    const lines = [];
    if (added.length) lines.push(`<li>New field(s) <b>${added.map(esc).join(', ')}</b> appear on all <b>${objsOf.length}</b> object(s) of this type.</li>`);
    if (renames.length) lines.push(`<li>Renaming ${renames.map(([a, b]) => `<b>${esc(a)}</b> → <b>${esc(b)}</b>`).join(', ')} moves the values.</li>`);
    if (removed.length) lines.push(`<li>Removed field(s) <b>${removed.map(f => esc(f.label)).join(', ')}</b> stay on the existing objects as their own fields (with values). New objects won't have them.</li>`);
    if (!await confirmBox('Apply template changes?', `<ul>${lines.join('')}</ul>${affected.length ? `${affected.length} object file(s) will be updated, previous versions go to history.` : ''}`, 'Apply')) return;
  }
  const clean = normTemplate(t.key, { ...t, fields: t.fields.map(f => ({ ...f, options: f.options })) });
  try {
    await state.fs.write(['_templates', t.key + '.yaml'], dumpTemplate(clean));
    state.templates[t.key] = clean;
    let skipped = 0;
    for (const o of affected) {
      const c = clone({ ...o, mtime: undefined }); const nf = {};
      for (const [k, v] of Object.entries(o.fields)) { const rn = renames.find(([a]) => a === k); nf[rn ? rn[1] : k] = v; }
      c.customFields = (c.customFields || []).filter(f => !newLabels.has(f.label));
      for (const f of removed) if (!c.customFields.some(x => x.label === f.label)) c.customFields.push(clone(f));
      c.fields = nf; c.updated = nowStamp();
      const r = await persist(c, o); if (!r.ok) skipped++;
    }
    selectTemplate(t.key); rebuildIndex(); render();
    toast(`Template saved${affected.length ? `, ${affected.length - skipped} object(s) updated` : ''}${skipped ? `, ${skipped} skipped (changed on disk)` : ''}`, skipped ? 'warn' : 'ok');
  } catch (e) { toast('Save failed: ' + esc(e.message), 'err'); }
}

async function saveAsTemplate(o) {
  const used = new Set(Object.values(state.templates).map(t => t.prefix));
  const slug = s => lc(s).normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_]+/g, '-').replace(/-+/g, '-').slice(0, 30) || 'type';
  const r = await modal({ title: `New template from “${o.name}”`, body: `
    <p class="note" style="margin-top:0">Takes the icon, colour and all fields (names and types, not values) of this object.</p>
    <label class="f">Template name</label><input name="name" value="${esc(tplOf(o)?.name ? tplOf(o).name + ' (copy)' : o.name)}">
    <label class="f">Id prefix (letters/digits, used for new objects: prefix-0001)</label><input name="prefix" class="mono" placeholder="e.g. ups">
    ${!o.template ? `<label class="chk" style="margin-top:10px"><input type="checkbox" name="use" checked> Use this template for “${esc(o.name)}” (its id stays ${esc(o.id)})</label>` : ''}<div class="m-err msg err"></div>`,
    buttons: [{ label: 'Cancel' }, { label: 'Create template', value: 'ok', primary: true, validate: v => !v.name.trim() ? 'Name is required' : !/^[a-z0-9]+$/.test(v.prefix.trim().toLowerCase()) ? 'Prefix: letters and digits only' : used.has(v.prefix.trim().toLowerCase()) ? 'Prefix already used' : state.templates[slug(v.name)] ? 'A template with this name exists' : '' }] });
  if (!r) return;
  const key = slug(r.name);
  const fields = fieldList(o).map(x => ({ ...x.f })).map(f => f.type === 'ref' || f.options ? f : { ...f, options: [] });
  const t = normTemplate(key, { name: r.name.trim(), prefix: r.prefix.trim().toLowerCase(), icon: iconOf(o), color: colorOf(o), fields, relations: [] });
  await state.fs.write(['_templates', key + '.yaml'], dumpTemplate(t)); state.templates[key] = t;
  if (r.use && !o.template) {
    const c = clone({ ...o, mtime: undefined }); c.template = key; c.customFields = []; c.icon = ''; c.color = ''; c.updated = nowStamp();
    const res = await persistUI(c, o); if (!res.ok) { rebuildIndex(); render(); return; }
  }
  rebuildIndex(); render(); toast(`Template <b>${esc(t.name)}</b> created`, 'ok');
}

/* ================= folders ================= */
async function folderMenu(anchor, path) {
  const empty = ![...state.objects.values()].some(o => o.folder === path || o.folder.startsWith(path + '/'));
  popMenu(anchor, [
    { label: '＋ New object here', run: () => { state.filter = { kind: 'folder', value: path }; newObject(); } },
    { label: '📁 New subfolder…', run: () => newFolder(path) },
    { label: '🧩 Default template…', run: () => setFolderTemplate(path) },
    { label: '✎ Rename…', run: () => renameFolder(path) },
    { label: '↪ Move to…', run: async () => { const dst = await chooseFolder(`Move “${path.split('/').at(-1)}” to…`, k => k !== path && !k.startsWith(path + '/') && k !== path.split('/').slice(0, -1).join('/')); if (dst != null) moveFolder(path, dst); } },
    { label: '🗑 Delete folder', danger: true, disabled: empty ? '' : 'Folder is not empty', run: () => deleteFolder(path) },
  ]);
}
async function newFolder(parent) {
  const tpls = Object.values(state.templates);
  const r = await modal({ title: parent ? `New folder in ${folderLabel(parent)}` : 'New folder', body: `<label class="f">Name</label><input name="n"><label class="f">Default template for new objects (optional)</label>
      <select name="t"><option value="">—</option>${tpls.map(t => `<option value="${esc(t.key)}">${esc(t.icon)} ${esc(t.name)}</option>`).join('')}</select><div class="m-err msg err"></div>`,
    buttons: [{ label: 'Cancel' }, { label: 'Create', value: 'ok', primary: true, validate: v => { const n = sanitizeFolder(v.n); if (!n) return 'Name required'; if (n.startsWith('_')) return 'Name cannot start with _'; if (state.folders.has([parent, n].filter(Boolean).join('/'))) return 'Already exists'; return ''; } }] });
  if (!r) return;
  const key = [parent, sanitizeFolder(r.n)].filter(Boolean).join('/');
  await state.fs.mkdir(['objects', ...folderSegs(key)]);
  if (r.t) await state.fs.write(['objects', ...folderSegs(key), '_folder.yaml'], `# Folder settings\ndefault_template: ${r.t}\n`);
  state.folders.set(key, { default_template: r.t }); state.collapsed.delete(parent);
  state.filter = { kind: 'folder', value: key }; render();
}
async function setFolderTemplate(path) {
  const cur = state.folders.get(path)?.default_template || '';
  const r = await modal({ title: `Default template: ${folderLabel(path)}`, body: `<select name="t"><option value="">—</option>${Object.values(state.templates).map(t => `<option value="${esc(t.key)}" ${t.key === cur ? 'selected' : ''}>${esc(t.icon)} ${esc(t.name)} (${esc(t.prefix)}-…)</option>`).join('')}</select><p class="note">Pre-selected when creating an object in this folder. The id prefix comes from the template.</p>`,
    buttons: [{ label: 'Cancel' }, { label: 'Save', value: 'ok', primary: true }] });
  if (!r) return;
  const p = ['objects', ...folderSegs(path), '_folder.yaml'];
  if (r.t) await state.fs.write(p, `# Folder settings\ndefault_template: ${r.t}\n`); else if (await state.fs.mtime(p) !== null) await state.fs.remove(p);
  state.folders.get(path).default_template = r.t; toast('Folder updated', 'ok');
}
async function renameFolder(path) {
  const segs = folderSegs(path); const name = await promptBox('Rename folder', 'New name', segs.at(-1), 'Rename'); if (!name) return;
  const nn = sanitizeFolder(name); if (!nn || nn === segs.at(-1)) return;
  const np = [...segs.slice(0, -1), nn];
  if (state.folders.has(np.join('/'))) { toast('A folder with that name exists', 'err'); return; }
  try {
    toast('Renaming…'); await copyDir(state.fs, ['objects', ...segs], ['objects', ...np]); await state.fs.remove(['objects', ...segs], true);
    if (state.filter.kind === 'folder' && (state.filter.value === path || state.filter.value.startsWith(path + '/'))) state.filter.value = np.join('/') + state.filter.value.slice(path.length);
    await loadRegister(); render(); toast('Folder renamed', 'ok');
  } catch (e) { toast('Rename failed: ' + esc(e.message) + '. Reload to see the current state.', 'err'); }
}
async function deleteFolder(path) {
  if (!await confirmBox('Delete folder?', `Delete the empty folder <b>${esc(folderLabel(path))}</b>?`, 'Delete', true)) return;
  await state.fs.remove(['objects', ...folderSegs(path)], true);
  for (const k of [...state.folders.keys()]) if (k === path || k.startsWith(path + '/')) state.folders.delete(k);
  if (state.filter.kind === 'folder' && state.filter.value.startsWith(path)) state.filter = { kind: 'all', value: '' };
  render();
}
