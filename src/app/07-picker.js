/* ================= object picker (search + folder tree) ================= */
let pickerClose = null;
function pickerStart(tpl) {
  if (!tpl || !state.templates[tpl]) return '';
  const fs = [...state.objects.values()].filter(o => o.template === tpl).map(o => folderSegs(o.folder));
  if (!fs.length) return [...state.folders].find(([, c]) => c.default_template === tpl)?.[0] || '';
  let common = fs[0]; for (const f of fs) { let i = 0; while (i < common.length && common[i] === f[i]) i++; common = common.slice(0, i); }
  return common.join('/');
}
function openPicker({ anchor, tpl = '', exclude = [], title = '', multi = false }) {
  return new Promise(resolve => {
    closeMenu(); if (pickerClose) pickerClose(null);
    const ex = new Set(exclude), hasTpl = !!(tpl && state.templates[tpl]);
    const ps = { q: '', all: !hasTpl, folder: pickerStart(tpl), sel: 0, picked: new Set() };
    const el = document.createElement('div'); el.className = 'picker';
    el.innerHTML = `<div class="pk-head"><input class="pk-q" placeholder="Search: name, id, IP, owner…" autocomplete="off" spellcheck="false">
        ${hasTpl ? `<label class="chk pk-all" title="Show all object types"><input type="checkbox"> all types</label>` : ''}</div>
      ${title || hasTpl ? `<div class="pk-title">${esc(title)}${hasTpl ? ` <span class="dim">· ${esc(state.templates[tpl].name)}</span>` : ''}</div>` : ''}
      <div class="pk-crumbs"></div><div class="pk-list"></div>
      ${multi ? `<div class="pk-multi"><span class="pk-count dim">Tick several objects, or click one to add it</span><span style="flex:1"></span><button class="sm" data-pk="clear" style="display:none">Clear</button><button class="sm primary" data-pk="addsel" style="display:none">Add</button></div>` : ''}
      <div class="pk-foot"><kbd>↑</kbd><kbd>↓</kbd> move · <kbd>Enter</kbd> open/choose${multi ? ' · <kbd>Space</kbd> tick' : ''} · <kbd>⌫</kbd> back · <kbd>Esc</kbd> close</div>`;
    document.body.appendChild(el);
    const r = anchor.getBoundingClientRect(), W = Math.min(460, innerWidth - 16), H = 470;
    el.style.width = W + 'px';
    el.style.left = Math.max(8, Math.min(r.left, innerWidth - W - 8)) + 'px';
    el.style.top = (r.bottom + H + 8 < innerHeight ? r.bottom + 6 : Math.max(8, r.top - H - 6)) + 'px';
    const q = $('.pk-q', el), list = $('.pk-list', el), crumbs = $('.pk-crumbs', el);
    const match = o => !ex.has(o.id) && (ps.all || o.template === tpl);
    const score = o => { const n = lc(o.name), s = lc(ps.q); return o.id === s ? 5 : n === s ? 4 : n.startsWith(s) ? 3 : n.includes(s) ? 2 : 1; };
    let items = [];
    const draw = () => {
      const toks = lc(ps.q).split(/\s+/).filter(Boolean);
      if (toks.length) {
        crumbs.innerHTML = `<span class="dim">Search results</span>`;
        items = [...state.objects.values()].filter(o => match(o) && toks.every(t => haystack(o).includes(t)))
          .sort((a, b) => score(b) - score(a) || a.name.localeCompare(b.name, undefined, { numeric: true })).slice(0, 150).map(o => ({ o }));
      } else {
        const segs = folderSegs(ps.folder);
        crumbs.innerHTML = `<button class="sm" data-pk="back" ${segs.length ? '' : 'disabled'}>◀ Back</button>
          <a data-pk="crumb" data-path="">Objects</a>${segs.map((s, i) => ` › <a data-pk="crumb" data-path="${esc(segs.slice(0, i + 1).join('/'))}">${esc(s)}</a>`).join('')}`;
        const objs = [...state.objects.values()].filter(match);
        const kids = [...state.folders.keys()].filter(k => k && k.split('/').slice(0, -1).join('/') === ps.folder).sort((a, b) => a.localeCompare(b));
        const dirs = kids.map(k => ({ k, n: objs.filter(o => o.folder === k || o.folder.startsWith(k + '/')).length })).filter(x => x.n);
        const here = objs.filter(o => o.folder === ps.folder).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })).map(o => ({ o }));
        items = [...dirs, ...here];
      }
      ps.sel = Math.max(0, Math.min(ps.sel, items.length - 1));
      list.innerHTML = items.map((it, i) => it.k != null
        ? `<div class="pk-row ${i === ps.sel ? 'on' : ''}" data-pi="${i}"><span class="ico xs dir">📁</span><span class="nm">${esc(it.k.split('/').at(-1))}</span><span class="dim">${it.n} ›</span></div>`
        : `<div class="pk-row ${i === ps.sel ? 'on' : ''} ${ps.picked.has(it.o.id) ? 'picked' : ''}" data-pi="${i}">${multi ? `<span class="pk-cb" data-cb="${i}">${ps.picked.has(it.o.id) ? '✓' : ''}</span>` : ''}${objIcon(it.o, 'xs')}<span class="nm">${esc(it.o.name)}</span><span class="dim sub">${esc([it.o.id, tplOf(it.o)?.name, toks.length ? folderLabel(it.o.folder) : fieldLike(it.o, /^ip/i)].filter(Boolean).join(' · '))}</span></div>`).join('')
        || `<div class="empty">${toks.length ? 'Nothing found' : 'No objects here'}${!ps.all && hasTpl ? '<br><a data-pk="all">Show all types</a>' : ''}</div>`;
      $('.pk-row.on', list)?.scrollIntoView({ block: 'nearest' });
      if (multi) { const n = ps.picked.size; $('.pk-count', el).textContent = n ? `${n} selected` : 'Tick several objects, or click one to add it'; $('[data-pk=addsel]', el).style.display = n ? '' : 'none'; $('[data-pk=clear]', el).style.display = n ? '' : 'none'; $('[data-pk=addsel]', el).textContent = `Add ${n}`; }
    };
    const toggle = it => { if (!it || !it.o) return; ps.picked.has(it.o.id) ? ps.picked.delete(it.o.id) : ps.picked.add(it.o.id); draw(); };
    const close = v => { el.remove(); document.removeEventListener('keydown', onKey, true); document.removeEventListener('mousedown', onDown, true); pickerClose = null; resolve(v); };
    pickerClose = close;
    const back = () => { const s = folderSegs(ps.folder); if (s.length) { ps.folder = s.slice(0, -1).join('/'); ps.sel = 0; draw(); } };
    const done = ids => close(multi ? ids : ids[0]);
    const activate = it => { if (!it) return; if (it.k != null) { ps.folder = it.k; ps.sel = 0; draw(); q.focus(); } else if (multi && ps.picked.size) toggle(it); else done([it.o.id]); };
    const onKey = e => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(null); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); ps.sel = Math.min(items.length - 1, ps.sel + 1); draw(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); ps.sel = Math.max(0, ps.sel - 1); draw(); }
      else if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); if (multi && ps.picked.size && (e.ctrlKey || !items[ps.sel] || items[ps.sel].o)) done([...ps.picked]); else activate(items[ps.sel]); }
      else if (e.key === ' ' && multi && items[ps.sel]?.o && (document.activeElement !== q || !q.value)) { e.preventDefault(); toggle(items[ps.sel]); }
      else if (e.key === 'Backspace' && !q.value && document.activeElement === q) { e.preventDefault(); back(); }
    };
    const onDown = e => { if (!el.contains(e.target)) close(null); };
    document.addEventListener('keydown', onKey, true); document.addEventListener('mousedown', onDown, true);
    q.addEventListener('input', () => { ps.q = q.value; ps.sel = 0; draw(); });
    el.addEventListener('click', e => {
      const cb = e.target.closest('[data-cb]'); if (cb) { ps.sel = +cb.dataset.cb; toggle(items[ps.sel]); q.focus(); return; }
      const row = e.target.closest('[data-pi]'); if (row) return activate(items[+row.dataset.pi]);
      const a = e.target.closest('[data-pk]'); if (!a) return;
      if (a.dataset.pk === 'addsel') return done([...ps.picked]);
      if (a.dataset.pk === 'clear') { ps.picked.clear(); draw(); }
      else if (a.dataset.pk === 'back') back();
      else if (a.dataset.pk === 'crumb') { ps.folder = a.dataset.path; ps.sel = 0; draw(); }
      else if (a.dataset.pk === 'all') { ps.all = true; const c = $('.pk-all input', el); if (c) c.checked = true; draw(); }
      q.focus();
    });
    $('.pk-all input', el)?.addEventListener('change', e => { ps.all = e.target.checked; if (!ps.all) ps.folder = pickerStart(tpl); ps.sel = 0; draw(); q.focus(); });
    draw(); q.focus();
  });
}
