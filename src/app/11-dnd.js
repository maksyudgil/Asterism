/* ================= drag & drop (moving objects and folders) ================= */
let dragData = null;
document.addEventListener('dragstart', e => {
  if (!prefs.dnd || !state.fs) return;
  const f = e.target.closest?.('[data-drag-folder]'), r = e.target.closest?.('.row[data-id]');
  if (f) dragData = { kind: 'folder', path: f.dataset.dragFolder };
  else if (r) dragData = { kind: 'obj', id: r.dataset.id };
  else return;
  e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', dragData.path ?? dragData.id);
  setTimeout(() => document.body.classList.add('dragging'), 0);
});
document.addEventListener('dragend', () => { dragData = null; document.body.classList.remove('dragging'); $$('.drop').forEach(x => x.classList.remove('drop')); });
const dropOk = (dst) => {
  if (!dragData) return false;
  if (dragData.kind === 'obj') { const o = state.objects.get(dragData.id); return !!o && o.folder !== dst; }
  const src = dragData.path, parent = src.split('/').slice(0, -1).join('/');
  return dst !== src && !dst.startsWith(src + '/') && dst !== parent;
};
document.addEventListener('dragover', e => {
  const side = $('#side');
  if (dragData && side) { const r = side.getBoundingClientRect(); if (e.clientX >= r.left && e.clientX <= r.right) { if (e.clientY < r.top + 50) side.scrollTop -= 14; else if (e.clientY > r.bottom - 50) side.scrollTop += 14; } }
  const t = e.target.closest?.('[data-drop-folder]'); if (!t || !dragData) return;
  if (!dropOk(t.dataset.dropFolder)) return;
  e.preventDefault(); e.dataTransfer.dropEffect = 'move';
  $$('.drop').forEach(x => x !== t && x.classList.remove('drop')); t.classList.add('drop');
});
document.addEventListener('dragleave', e => { const t = e.target.closest?.('[data-drop-folder]'); if (t && !t.contains(e.relatedTarget)) t.classList.remove('drop'); });
document.addEventListener('drop', async e => {
  const t = e.target.closest?.('[data-drop-folder]'); if (!t || !dragData) return;
  e.preventDefault(); t.classList.remove('drop'); document.body.classList.remove('dragging');
  const d = dragData, dst = t.dataset.dropFolder, ok = dropOk(dst); dragData = null;
  if (!ok) return;
  try { d.kind === 'obj' ? await moveObject(d.id, dst) : await moveFolder(d.path, dst); }
  catch (err) { console.error(err); toast('Move failed: ' + esc(err.message), 'err'); }
});
async function chooseFolder(title, allow) {
  const keys = [...state.folders.keys()].filter(allow).sort();
  const r = await modal({ title, body: `<label class="f">Destination</label><select name="dst" size="12" style="height:auto">${keys.map((k, i) => `<option value="${esc(k)}" ${i === 0 ? 'selected' : ''}>${k ? '&nbsp;&nbsp;'.repeat(k.split('/').length - 1) + '📁 ' + esc(k.split('/').at(-1)) : '⤒ Top level (Objects)'}</option>`).join('')}</select>`,
    buttons: [{ label: 'Cancel' }, { label: 'Move', value: 'ok', primary: true }] });
  return r ? r.dst : null;
}

async function moveObject(id, dst) {
  const o = state.objects.get(id); if (!o || o.folder === dst) return;
  if (state.mode === 'edit' && state.draft?.id === id) { toast('Finish editing this object first', 'warn'); return; }
  const c = clone({ ...o, mtime: undefined }); c.folder = dst; c.updated = nowStamp();
  const r = await persistUI(c, o); if (!r.ok) return;
  rebuildIndex(); render(); toast(`Moved <b>${esc(o.name)}</b> to ${esc(folderLabel(dst))}`, 'ok');
}
async function moveFolder(src, dstParent) {
  const name = src.split('/').at(-1), np = [dstParent, name].filter(Boolean).join('/');
  if (np === src || dstParent === src || dstParent.startsWith(src + '/')) return;
  if (state.folders.has(np)) { toast(`${esc(folderLabel(np))} already exists`, 'err'); return; }
  const n = [...state.objects.values()].filter(o => o.folder === src || o.folder.startsWith(src + '/')).length;
  if (!await confirmBox('Move folder?', `Move <b>${esc(folderLabel(src))}</b> (${n} object${n === 1 ? '' : 's'}) into <b>${esc(dstParent ? folderLabel(dstParent) : 'top level')}</b>?<br><span class="dim">Ids and links do not change.</span>`, 'Move')) return;
  if (state.mode === 'edit' && state.draft && (state.draft.folder === src || state.draft.folder.startsWith(src + '/'))) { toast('Finish editing first', 'warn'); return; }
  toast('Moving…');
  await copyDir(state.fs, ['objects', ...folderSegs(src)], ['objects', ...folderSegs(np)]);
  await state.fs.remove(['objects', ...folderSegs(src)], true);
  if (state.filter.kind === 'folder' && (state.filter.value === src || state.filter.value.startsWith(src + '/'))) state.filter.value = np + state.filter.value.slice(src.length);
  state.collapsed.delete(dstParent);
  await loadRegister(); render(); toast(`Moved folder to ${esc(folderLabel(np))}`, 'ok');
}
