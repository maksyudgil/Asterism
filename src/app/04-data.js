/* ================= loading ================= */
async function readYaml(path, problems) {
  try { return jsyaml.load((await state.fs.read(path)).text, { schema: jsyaml.JSON_SCHEMA }) || {}; }
  catch (e) { if (!notFound(e)) problems.push({ sev: 'err', msg: `${path.join('/')}: ${e.message}` }); return null; }
}

/* run async jobs with at most `n` in flight (keeps SMB shares happy) */
function limiter(n) {
  let active = 0; const q = [];
  const next = () => { if (active >= n || !q.length) return; active++; const { fn, res, rej } = q.shift(); fn().then(res, rej).finally(() => { active--; next(); }); };
  return fn => new Promise((res, rej) => { q.push({ fn, res, rej }); next(); });
}
let fileCache = new Map();   // 'objects/…/file.md' → { mtime, o } from the previous load
async function loadRegister() {
  const fs = state.fs, problems = [], lim = limiter(16), cache = fs === fileCache.fs ? fileCache : new Map(), newCache = new Map();
  let reused = 0, read = 0;
  state.relTypes = normRelTypes(await readYaml(['_relations.yaml'], problems) || {});
  state.templates = {};
  for (const e of await fs.list(['_templates'])) {
    if (e.kind !== 'file' || !/\.ya?ml$/i.test(e.name)) continue;
    const key = e.name.replace(/\.ya?ml$/i, '');
    const t = await readYaml(['_templates', e.name], problems);
    if (t) state.templates[key] = normTemplate(key, t);
  }
  const objects = [], folders = new Map();
  async function walk(path) {
    const key = path.join('/'); folders.set(key, { default_template: '' });
    const entries = await lim(() => fs.list(['objects', ...path]));
    await Promise.all(entries.filter(e => e.kind === 'file' && !IGNORED_FILE(e.name)).map(async e => {
      const p = ['objects', ...path, e.name], pk = p.join('/');
      if (e.name === '_folder.yaml') { const c = await lim(() => readYaml(p, problems)); if (c) folders.get(key).default_template = str(c.default_template); return; }
      if (!/\.md$/i.test(e.name)) return;
      try {
        const old = cache.get(pk);
        if (old) {   // reload: only re-read files whose modification time changed
          const mt = await lim(() => fs.mtime(p));
          if (mt === old.mtime) { const o = clone(old.o); Object.assign(o, { folder: key, file: e.name, mtime: mt }); objects.push(o); newCache.set(pk, old); reused++; return; }
        }
        const { text, mtime } = await lim(() => fs.read(p)); read++;
        const { fm, body } = parseMd(text); const o = toObj(fm, body); newCache.set(pk, { mtime, o: clone(o) });
        Object.assign(o, { folder: key, file: e.name, mtime }); objects.push(o);
      }
      catch (err) { problems.push({ sev: 'err', msg: `Cannot read ${p.join('/')}: ${err.message}` }); }
    }));
    await Promise.all(entries.filter(e => e.kind === 'directory' && !e.name.startsWith('.')).map(e => walk([...path, e.name])));
  }
  await walk([]);
  fileCache = newCache; fileCache.fs = fs; state.loadStats = { read, reused };
  // ids already used (also by deleted objects, whose history stays): used by nextId without walking the share again
  state.usedIds = new Set((await fs.list(['_history'])).map(e => e.name));
  state.folders = folders;
  state.objects = new Map();
  for (const o of objects.sort((a, b) => objPath(a).join('/').localeCompare(objPath(b).join('/')))) {
    if (!o.id) { problems.push({ sev: 'err', msg: `${objPath(o).join('/')}: no "id" in the file` }); continue; }
    if (state.objects.has(o.id)) { problems.push({ sev: 'err', msg: `Duplicate id ${o.id}: ${objPath(o).join('/')} is ignored (also in ${objPath(state.objects.get(o.id)).join('/')})` }); continue; }
    state.objects.set(o.id, o);
  }
  state.loadProblems = problems;
  rebuildIndex();
  if (state.selectedId && !state.objects.has(state.selectedId)) state.selectedId = null;
}

function rebuildIndex() {
  const P = [...state.loadProblems];
  state.inbound = new Map(); state.hay = new Map(); state.dupMap = new Map();
  const objs = [...state.objects.values()];
  for (const o of objs) {
    if (!o.file.toLowerCase().startsWith(o.id.toLowerCase())) P.push({ sev: 'warn', id: o.id, msg: `File name "${o.file}" does not start with id ${o.id} (id inside the file is used)` });
    if (o.template && !state.templates[o.template]) P.push({ sev: 'warn', id: o.id, msg: `Unknown template "${o.template}"` });
    for (const r of o.relations) {
      if (!state.objects.has(r.target)) P.push({ sev: 'err', id: o.id, msg: `Broken relation "${relOf(r.type).label}" → ${r.target} (object not found)` });
      else { if (!state.inbound.has(r.target)) state.inbound.set(r.target, []); state.inbound.get(r.target).push({ from: o.id, type: r.type }); }
      if (!state.relTypes[r.type]) P.push({ sev: 'warn', id: o.id, msg: `Unknown relation type "${r.type}"` });
    }
  }
  // unique-field duplicates
  const uniq = new Map();
  for (const o of objs) for (const f of tplOf(o)?.fields || []) {
    const v = lc(o.fields[f.label]); if (!f.unique || !v) continue;
    const k = f.label + '\u0000' + v; if (!uniq.has(k)) uniq.set(k, []); uniq.get(k).push(o.id);
  }
  for (const [k, ids] of uniq) if (ids.length > 1) {
    const label = k.split('\u0000')[0], v = state.objects.get(ids[0]).fields[label];
    for (const id of ids) state.dupMap.set(id + '\u0000' + label, ids.filter(x => x !== id));
    P.push({ sev: 'warn', id: ids[0], ids, msg: `Same "${label}" = ${v} in: ${ids.map(i => state.objects.get(i).name).join(', ')}` });
  }
  state.problems = P;
}

function haystack(o) {
  let h = state.hay.get(o.id);
  if (!h) { h = lc([o.id, o.name, tplOf(o)?.name, o.folder, o.tags.join(' '), Object.values(o.fields).join(' '), o.relations.map(r => state.objects.get(r.target)?.name || '').join(' '), o.notes].join(' ')); state.hay.set(o.id, h); }
  return h;
}
function filteredObjects() {
  let list = [...state.objects.values()]; const f = state.filter;
  if (f.kind === 'folder' && f.value) list = list.filter(o => o.folder === f.value || o.folder.startsWith(f.value + '/'));
  else if (f.kind === 'tag') list = list.filter(o => o.tags.includes(f.value));
  else if (f.kind === 'template') list = list.filter(o => o.template === f.value);
  const toks = lc(state.search).split(/\s+/).filter(Boolean);
  if (toks.length) list = list.filter(o => { const h = haystack(o); return toks.every(t => h.includes(t)); });
  return list.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
}

/* ================= persistence ================= */
async function writeHistory(id, text, suffix = '') {
  let name = fileStamp() + suffix, i = 1;
  while (await state.fs.mtime(['_history', id, name + '.md']) !== null) name = fileStamp() + suffix + '-' + (++i);
  await state.fs.write(['_history', id, name + '.md'], text);
}

/** write object o; prev = version currently on disk (in memory) or null for a new object */
async function persist(o, prev, { force = false, histSuffix = '' } = {}) {
  const fs = state.fs; o.file = fileNameFor(o.id, o.name); const np = objPath(o);
  if (prev) {
    const pp = objPath(prev); const mt = await fs.mtime(pp);
    if (!force) { if (mt === null) return { conflict: 'missing' }; if (mt !== prev.mtime) return { conflict: 'changed' }; }
    const same = pp.join('/') === np.join('/'), sameCi = lc(pp.join('/')) === lc(np.join('/'));
    if (mt !== null) {
      await writeHistory(o.id, (await fs.read(pp)).text, histSuffix);
      if (sameCi && !same) await fs.remove(pp);           // case-only rename on a case-insensitive disk
    }
    o.mtime = await fs.write(np, serialize(o, state.templates));
    if (mt !== null && !sameCi) await fs.remove(pp);
  } else {
    if (await fs.mtime(np) !== null) return { conflict: 'exists' };
    o.mtime = await fs.write(np, serialize(o, state.templates));
  }
  state.objects.set(o.id, o);
  return { ok: true };
}

async function persistUI(o, prev) {
  let r = await persist(o, prev);
  if (r.conflict === 'changed') {
    const c = await modal({ title: 'Changed by someone else', body: `<b>${esc(prev.name)}</b> was modified on disk after you opened it.<br>Overwrite with your version (the other version is kept in history), or discard your edits and reload?`,
      buttons: [{ label: 'Cancel' }, { label: 'Discard mine & reload', value: 'reload' }, { label: 'Overwrite', value: 'over', danger: true }] });
    if (c?.btn === 'over') r = await persist(o, prev, { force: true });
    else if (c?.btn === 'reload') { await reloadOne(prev); return { reloaded: true }; }
    else return { cancelled: true };
  } else if (r.conflict === 'missing') {
    if (await confirmBox('File not found', `The file of <b>${esc(prev.name)}</b> was moved or deleted on disk. Save your version as a new file?`, 'Save')) r = await persist(o, prev, { force: true });
    else return { cancelled: true };
  } else if (r.conflict === 'exists') { toast(`File ${esc(o.file)} already exists. Reload and try again.`, 'err'); return { cancelled: true }; }
  return r;
}

async function reloadOne(prev) {
  try {
    const { text, mtime } = await state.fs.read(objPath(prev)); const { fm, body } = parseMd(text);
    const o = toObj(fm, body); Object.assign(o, { folder: prev.folder, file: prev.file, mtime }); state.objects.set(o.id, o);
  } catch (e) { await loadRegister(); }
  state.mode = 'view'; state.draft = null; rebuildIndex(); render();
}

/* next free id for a prefix: highest id known from the last load (objects + history), plus a fresh look at
   the target folder in case someone else just created an object there */
async function nextId(prefix, extraTaken = [], folder = null) {
  let max = 0; const re = new RegExp('^' + escRe(prefix) + '-(\\d+)(?!\\w)', 'i');
  const see = n => { const m = String(n).match(re); if (m) max = Math.max(max, +m[1]); };
  state.objects.forEach((_, id) => see(id)); (state.usedIds || []).forEach(see); extraTaken.forEach(see);
  if (folder != null) (await state.fs.list(['objects', ...folderSegs(folder)])).forEach(e => see(e.name));
  else { const walk = async p => { for (const e of await state.fs.list(p)) { see(e.name); if (e.kind === 'directory') await walk([...p, e.name]); } }; await walk(['objects']); }
  return `${prefix}-${String(max + 1).padStart(4, '0')}`;
}
