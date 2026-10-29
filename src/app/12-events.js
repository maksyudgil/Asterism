/* ================= events ================= */
const actions = {
  pick: pickFolder, reconnect, demo: () => openFS(new MemFS(window.DEMO_FILES)),
  'close-register': async () => { if (state.mode === 'edit' && state.draft?.dirty && !await confirmBox('Discard changes?', 'You have unsaved changes.', 'Discard', true)) return; destroyGraph(); state.fs = null; try { state.storedHandle = await idb.get('root'); } catch (e) { } renderWelcome(); },
  view: async el => { if (state.mode === 'edit' && state.draft?.dirty && !await confirmBox('Discard changes?', 'You have unsaved changes.', 'Discard', true)) return; if (state.mode === 'edit') { state.mode = 'view'; state.draft = null; } state.view = el.dataset.v; state.relDraft = null; render(); },
  new: () => newObject(),
  reload: async () => { if (state.mode === 'edit' && state.draft?.dirty && !await confirmBox('Discard changes?', 'Reloading discards your unsaved changes.', 'Reload', true)) return; state.mode = 'view'; state.draft = null; gNodeCache = new Map(); await loadRegister(); render(); toast(`Reloaded: ${state.loadStats.read} changed file(s) read, ${state.loadStats.reused} unchanged`, 'ok'); },
  filter: async el => {
    if (state.mode === 'edit' && state.draft?.dirty && !await confirmBox('Discard changes?', 'You have unsaved changes.', 'Discard', true)) return;
    if (state.mode === 'edit') { state.mode = 'view'; state.draft = null; }
    state.filter = { kind: el.dataset.k, value: el.dataset.v }; if (state.view === 'settings' || state.view === 'dashboard') state.view = 'items';
    if (state.view === 'graph') { state.graph.local = false; renderSide(); renderGraphView(); } else render();
  },
  'toggle-folder': (el, ev) => { ev.stopPropagation(); const p = el.dataset.path; state.collapsed.has(p) ? state.collapsed.delete(p) : state.collapsed.add(p); renderSide(); },
  'folder-menu': (el, ev) => { ev.stopPropagation(); folderMenu(el, el.dataset.path); },
  'new-folder': (el, ev) => { ev.stopPropagation(); newFolder(el.dataset.path); },
  open: async el => { if (state.mode === 'edit' && state.draft?.dirty && !await confirmBox('Discard changes?', 'You have unsaved changes.', 'Discard', true)) return; state.mode = 'view'; state.draft = null; state.selectedId = el.dataset.id; state.histSel = null; $$('#list .row').forEach(r => r.classList.toggle('on', r.dataset.id === state.selectedId)); renderDetail(); $('#detail').scrollTop = 0; },
  goto: async el => { if (state.mode === 'edit' && state.draft?.dirty && !await confirmBox('Discard changes?', 'You have unsaved changes.', 'Discard', true)) return; openCard(el.dataset.id); $$('#list .row').forEach(r => r.classList.toggle('on', r.dataset.id === state.selectedId)); const r = $(`#list .row.on`); r && r.scrollIntoView({ block: 'nearest' }); },
  tab: el => { state.tab = el.dataset.tab; renderDetail(); },
  'toggle-empty': () => { state.showEmpty = !state.showEmpty; renderDetail(); },
  copy: async el => { try { await navigator.clipboard.writeText(el.dataset.v); toast('Copied'); } catch (e) { toast('Copy failed', 'err'); } },
  edit: () => { const o = state.objects.get(state.selectedId); if (o) startEdit(makeDraft(o)); },
  dup: () => { const o = state.objects.get(state.selectedId); o && duplicateObject(o); },
  multi: () => { const o = state.objects.get(state.selectedId); o && createMultiple(o); },
  'graph-local': () => { state.view = 'graph'; state.graph.local = true; state.graph.infoOpen = true; render(); },
  'obj-menu': el => { const o = state.objects.get(state.selectedId); if (!o) return; popMenu(el, [
    { label: '📋 Copy id', run: () => navigator.clipboard.writeText(o.id).then(() => toast('Copied ' + esc(o.id))) },
    { label: '📄 Copy file path', run: () => navigator.clipboard.writeText(objPath(o).join('\\')).then(() => toast('Copied')) },
    { label: '↪ Move to folder…', run: async () => { const dst = await chooseFolder(`Move “${o.name}” to…`, k => k !== o.folder); if (dst != null) moveObject(o.id, dst); } },
    { label: '🧩 Save as new template…', run: () => saveAsTemplate(o) },
    { label: '🗑 Delete…', danger: true, run: () => deleteObject(o) }]); },
  save: () => saveDraft(), cancel: () => cancelEdit(),
  'pick-icon': async () => {
    const d = state.draft, t = state.templates[d.template];
    const r = await iconPicker(d.icon, d.color, { icon: t?.icon || '📄', color: t?.color || '#8b8d98' }); if (!r) return;
    d.icon = r.icon === (t?.icon || '') ? '' : r.icon; d.color = r.color === (t?.color || '') ? '' : r.color; d.dirty = true; renderEditKeep();
  },
  'add-field': async () => {
    const d = state.draft; const f = await addFieldDialog([...fieldDefs(d).map(x => x.label), ...Object.keys(d.fields)]); if (!f) return;
    if (f.type === 'text') d.fields[f.label] = ''; else { d.customFields.push(f); if (f.type !== 'ref') d.fields[f.label] = ''; }
    d.dirty = true; renderEditKeep(); const i = $(`[data-bind=field][data-key="${CSS.escape(f.label)}"]`); i && i.focus();
  },
  'rm-field': el => {
    const d = state.draft, k = el.dataset.key, def = d.customFields.find(f => f.label === k);
    if (def?.type === 'ref') { const drop = new Set((assignRefs(d.relations, d.template, d.customFields).byField.get(k) || []).map(r => r.i)); d.relations = d.relations.filter((_, i) => !drop.has(i)); }
    d.customFields = d.customFields.filter(f => f.label !== k); delete d.fields[k]; d.dirty = true; renderEditKeep();
  },
  'add-rel': async el => {
    const d = state.draft, tpl = state.templates[d.template] || { relations: [] };
    let s = el.dataset.si != null ? tpl.relations[+el.dataset.si] : null;
    if (!s) {   // choose the relation type first
      const type = await new Promise(res => { popMenu(el, Object.values(state.relTypes).map(r => ({ label: `● ${r.label}`, run: () => res(r.key) }))); const iv = setInterval(() => { if (!menuEl) { clearInterval(iv); res(null); } }, 200); });
      if (!type) return; s = { type, target: '' };
    }
    await addRelations(el, s.type, s.target);
  },
  'group-add': el => addRelations(el, el.dataset.type, ''),
  'group-drop': el => { const d = state.draft; d.relGroups = (d.relGroups || []).filter(x => x !== el.dataset.type); renderEditKeep(); },
  'chip-menu': (el, ev) => {
    if (ev.target.closest('.x')) return;
    const d = state.draft, i = +el.dataset.i, r = d.relations[i]; if (!r) return;
    popMenu(el, [
      ...Object.values(state.relTypes).filter(t => t.key !== r.type).map(t => ({ label: `→ ${t.label}`, run: () => { if (d.relations.some(x => x.type === t.key && x.target === r.target)) d.relations.splice(i, 1); else r.type = t.key; d.dirty = true; renderEditKeep(); } })),
      { label: '✕ Remove', danger: true, run: () => { d.relations.splice(i, 1); d.dirty = true; renderEditKeep(); } }]);
  },
  'ref-add': async el => {
    const d = state.draft, f = fieldDefs(d).find(x => x.label === el.dataset.key); if (!f) return;
    const cur = assignRefs(d.relations, d.template, d.customFields).byField.get(f.label) || [];
    let ids = await openPicker({ anchor: el, tpl: f.target, exclude: [...(d.isNew ? [] : [d.id]), ...cur.map(r => r.target)], title: f.label, multi: f.multiple });
    if (!ids) return; ids = [].concat(ids);
    if (!f.multiple) { const drop = new Set(cur.map(r => r.i)); d.relations = d.relations.filter((_, i) => !drop.has(i)); }
    for (const id of ids) d.relations.push({ type: f.relation, target: id });
    d.reset = d.reset.filter(x => x !== f.label); d.dirty = true; renderEditKeep();
  },
  export: () => exportDialog(),
  'toggle-dnd': (el, ev) => { ev.stopPropagation(); prefs.dnd = !prefs.dnd; savePrefs(); renderSide(); if (state.view === 'items') renderList(); toast(prefs.dnd ? 'Drag & drop on: drag objects or folders onto a folder' : 'Drag & drop off'); },
  'g-find': async el => { const id = await openPicker({ anchor: el, title: 'Fly to object' }); if (id) flyTo(id); },
  'g-png': () => graphPng(),
  home: async () => { if (state.mode === 'edit' && state.draft?.dirty && !await confirmBox('Discard changes?', 'You have unsaved changes.', 'Discard', true)) return; state.mode = 'view'; state.draft = null; state.view = 'dashboard'; state.filter = { kind: 'all', value: '' }; render(); },
  'dash-graph': () => { state.graph.mode = 'tree'; state.view = 'graph'; render(); },
  'g-mode': el => { state.graph.mode = el.dataset.v; state.graph.infoOpen = false; state.graph.selFolder = null; saveGraphPrefs(); renderGraphView(); },
  'g-folder-toggle': () => { toggleFolder(state.graph.selFolder); renderGInfo(); },
  'g-folder-list': () => { state.filter = { kind: 'folder', value: state.graph.selFolder }; state.view = 'items'; render(); },
  'g-expand-all': () => { const g = state.graph, root = g.expandedRoot || ''; for (const k of state.folders.keys()) if (!root || k === root || k.startsWith(root + '/')) g.expanded.add(k); updateGraph(true); },
  'g-collapse-all': () => { const g = state.graph; g.expanded = new Set([g.expandedRoot || '']); updateGraph(true); },
  'rm-rel': el => { state.draft.relations.splice(+el.dataset.i, 1); state.draft.dirty = true; renderEditKeep(); },
  'rm-tag': el => { state.draft.tags = state.draft.tags.filter(t => t !== el.dataset.tag); state.draft.dirty = true; renderEditKeep(); },
  'hist-open': el => { state.histSel = el.dataset.file; renderHistory(state.objects.get(state.selectedId)); },
  'hist-restore': el => restoreVersion(state.objects.get(state.selectedId), el.dataset.file),
  'g-panel': () => { state.graph.panelMin = !state.graph.panelMin; $('#gpanel').classList.toggle('min', state.graph.panelMin); $('#gpanel .collapse').textContent = state.graph.panelMin ? '☰ Graph settings' : '–'; },
  'g-fit': () => fitView(500),
  'g-reheat': () => { if (!FG) return; FG.graphData().nodes.forEach(n => { n.fx = n.fy = undefined; }); FG.d3ReheatSimulation(); },
  'g-relall': () => { state.graph.hidden.clear(); $$('[data-grel]').forEach(c => c.checked = true); updateGraph(); },
  'g-relnone': () => { Object.keys(state.relTypes).forEach(k => state.graph.hidden.add(k)); $$('[data-grel]').forEach(c => { c.checked = false; state.graph.hidden.add(c.dataset.grel); }); updateGraph(); },
  'g-goto': el => flyTo(el.dataset.id),
  'g-open': () => openCard(state.selectedId),
  'g-local': () => { state.graph.local = true; renderGraphView(); },
  'set-sel': el => { if (el.dataset.kind === 'rel') { state.settingsSel = { kind: 'rel' }; state.relDraft = null; } else selectTemplate(el.dataset.key); renderSettings(); },
  'fx-glass': () => { prefs.solid = !prefs.solid; savePrefs(); applyAppearance(); toast(prefs.solid ? 'Glass effect off' : 'Glass effect on'); },
  'fx-motion': () => { prefs.nomotion = !prefs.nomotion; savePrefs(); applyAppearance(); if (matchMedia('(prefers-reduced-motion: reduce)').matches && !prefs.nomotion) toast('Animations are turned off in Windows settings', 'warn'); else toast(prefs.nomotion ? 'Animations off' : 'Animations on'); },
  'tpl-new': () => { state.settingsSel = { kind: 'tpl', key: null }; state.tplDraft = { isNew: true, key: '', origKey: null, name: '', prefix: '', icon: '📄', color: '#7aa2f7', fields: [{ label: 'Description', type: 'multiline', options: [], unique: '', required: false, reset_on_copy: false }], relations: [] }; renderSettings(); },
  'tpl-add-field': () => { state.tplDraft.fields.push({ label: '', type: 'text', options: [], unique: '', required: false, reset_on_copy: false, relation: '', target: '', multiple: true }); renderTplEditor(); $$('[data-fb=label]').at(-1)?.focus(); },
  'tpl-rm-field': el => { state.tplDraft.fields.splice(+el.dataset.i, 1); renderTplEditor(); },
  'tpl-up': el => { const f = state.tplDraft.fields, i = +el.dataset.i; [f[i - 1], f[i]] = [f[i], f[i - 1]]; renderTplEditor(); },
  'tpl-down': el => { const f = state.tplDraft.fields, i = +el.dataset.i; [f[i + 1], f[i]] = [f[i], f[i + 1]]; renderTplEditor(); },
  'tpl-add-rel': () => { state.tplDraft.relations.push({ type: Object.keys(state.relTypes)[0] || '', target: '' }); renderTplEditor(); },
  'tpl-rm-rel': el => { state.tplDraft.relations.splice(+el.dataset.i, 1); renderTplEditor(); },
  'tpl-revert': () => { if (state.tplDraft.isNew) { state.settingsSel = { kind: 'rel' }; state.tplDraft = null; } else selectTemplate(state.tplDraft.origKey); renderSettings(); },
  'tpl-save': () => saveTemplate(),
  'tpl-icon': async () => { const t = state.tplDraft; const r = await iconPicker(t.icon, t.color, { icon: '📄', color: '#8b8d98' }); if (!r) return; if (r.icon) t.icon = r.icon; if (r.color) t.color = r.color; renderTplEditor(); },
  'tpl-delete': async () => { const t = state.tplDraft; if (!await confirmBox('Delete template?', `Delete template <b>${esc(t.name)}</b>? No objects use it.`, 'Delete', true)) return; await state.fs.remove(['_templates', t.origKey + '.yaml']); delete state.templates[t.origKey]; for (const [k, f] of state.folders) if (f.default_template === t.origKey) f.default_template = ''; state.settingsSel = { kind: 'rel' }; state.tplDraft = null; rebuildIndex(); render(); },
  'rel-add': () => { state.relDraft.push({ key: '', label: '', inverse: '', color: PALETTE[state.relDraft.length % PALETTE.length], category: '', orig: null }); renderRelEditor(); $$('[data-rb=key]').at(-1)?.focus(); },
  'rel-rm': el => { state.relDraft.splice(+el.dataset.i, 1); renderRelEditor(); },
  'rel-reset': () => { state.relDraft = null; renderRelEditor(); },
  'rel-save': () => saveRelTypes(),
};

document.addEventListener('click', ev => {
  const el = ev.target.closest('[data-act]'); if (!el || el.disabled) return;
  const fn = actions[el.dataset.act]; if (fn) { ev.preventDefault(); Promise.resolve(fn(el, ev)).catch(e => { console.error(e); toast(esc(e.message), 'err'); }); }
});
document.addEventListener('input', e => {
  if (e.target.closest('#detail')) onEditInput(e);
  const t = e.target;
  if (t.dataset.rb && state.relDraft) state.relDraft[+t.dataset.i][t.dataset.rb] = t.value;
  if (t.dataset.tb && state.tplDraft) state.tplDraft[t.dataset.tb] = t.value;
  if (t.dataset.fb && state.tplDraft && t.type !== 'checkbox' && t.tagName !== 'SELECT') { const f = state.tplDraft.fields[+t.dataset.i]; f[t.dataset.fb] = t.dataset.fb === 'options' ? t.value.split(',').map(s => s.trim()).filter(Boolean) : t.value; }
});
document.addEventListener('change', e => {
  const t = e.target;
  if (t.closest('#detail')) { onEditInput(e); onEditChange(e); }
  if (t.dataset.fb && state.tplDraft && (t.type === 'checkbox' || t.tagName === 'SELECT')) {
    const f = state.tplDraft.fields[+t.dataset.i]; f[t.dataset.fb] = t.type === 'checkbox' ? t.checked : t.value;
    if (t.dataset.fb === 'type' && t.value === 'ref') { if (!f.relation) f.relation = Object.keys(state.relTypes)[0] || ''; if (f.multiple == null) f.multiple = true; f.unique = ''; }
    if (t.dataset.fb === 'type' || t.dataset.fb === 'label') renderTplEditor();
  }
  if (t.dataset.fb === 'label' && state.tplDraft) renderTplEditor();
  if (t.dataset.sb && state.tplDraft) state.tplDraft.relations[+t.dataset.i][t.dataset.sb] = t.value;
});
document.addEventListener('keydown', e => {
  const t = e.target;
  if (t.id === 'tagin' && (e.key === 'Enter' || e.key === ',')) {
    e.preventDefault(); const v = t.value.trim().replace(/^#/, '').replace(/\s+/g, '-'); if (v && !state.draft.tags.includes(v)) { state.draft.tags.push(v); state.draft.dirty = true; }
    t.value = ''; renderEditKeep(); $('#tagin')?.focus(); return;
  }
  if (t.id === 'tagin' && e.key === 'Backspace' && !t.value && state.draft.tags.length) { state.draft.tags.pop(); state.draft.dirty = true; renderEditKeep(); $('#tagin')?.focus(); return; }
  if ($('.modal-bg') || pickerClose) return;
  const typing = /INPUT|TEXTAREA|SELECT/.test(t.tagName);
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's' && state.mode === 'edit') { e.preventDefault(); t.blur?.(); saveDraft(); return; }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k' && state.fs) { e.preventDefault(); $('#q')?.focus(); $('#q')?.select(); return; }
  if (e.key === 'Escape' && state.mode === 'edit') { e.preventDefault(); cancelEdit(); return; }
  if (e.key === 'Escape' && t.id === 'q') { t.value = ''; state.search = ''; state.view === 'items' ? renderList() : updateGraph(); return; }
  if (!typing && e.key.toLowerCase() === 'e' && state.mode === 'view' && state.view === 'items' && state.objects.has(state.selectedId)) { e.preventDefault(); actions.edit(); }
});
window.addEventListener('beforeunload', e => { if (state.mode === 'edit' && state.draft?.dirty) { e.preventDefault(); e.returnValue = ''; } });
