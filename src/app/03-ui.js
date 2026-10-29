/* ================= modal / menu ================= */
/* one backdrop + dialog shell for every popup (modal, icon picker, new-object gallery) */
function overlay(html, cls = '') {
  const wrap = document.createElement('div'); wrap.className = 'modal-bg';
  wrap.innerHTML = `<div class="modal ${cls}" role="dialog">${html}</div>`;
  $('#modal-root').appendChild(wrap);
  let open = true;
  const ctl = { wrap, onKey: null, onClose: null, close(v) { if (!open) return; open = false; document.removeEventListener('keydown', key, true); wrap.remove(); ctl.onClose && ctl.onClose(v); } };
  const key = e => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); ctl.close(null); } else if (ctl.onKey) ctl.onKey(e); };
  document.addEventListener('keydown', key, true);
  wrap.addEventListener('mousedown', e => { if (e.target === wrap) ctl.close(null); });
  return ctl;
}
function modal({ title, body = '', buttons = [{ label: 'OK', value: 'ok', primary: true }], wide = false, onOpen }) {
  return new Promise(resolve => {
    const ctl = overlay(`<h2>${esc(title)}</h2><div class="m-body">${body}</div>
      <div class="m-btns">${buttons.map((b, i) => `<button data-mi="${i}" class="${b.primary ? 'primary' : ''} ${b.danger ? 'danger' : ''}">${esc(b.label)}</button>`).join('')}</div>`, wide ? 'wide' : '');
    const wrap = ctl.wrap; ctl.onClose = resolve;
    const collect = () => { const v = {}; $$('[name]', wrap).forEach(i => { if (i.type === 'radio') { if (i.checked) v[i.name] = i.value; } else v[i.name] = i.type === 'checkbox' ? i.checked : i.value; }); return v; };
    const press = i => { const b = buttons[i]; const vals = collect(); if (b.validate) { const err = b.validate(vals, wrap); if (err) { const m = $('.m-err', wrap); if (m) m.textContent = err; return; } } ctl.close(b.value == null ? null : { btn: b.value, ...vals }); };
    ctl.onKey = e => { if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA' && e.target.tagName !== 'BUTTON') { const i = buttons.findIndex(b => b.primary || b.danger); if (i >= 0) { e.preventDefault(); e.stopPropagation(); press(i); } } };
    wrap.addEventListener('click', e => { const b = e.target.closest('[data-mi]'); if (b) press(+b.dataset.mi); });
    onOpen && onOpen(wrap);
    const f = $('input:not([type=checkbox]),select,textarea', wrap) || $('button.primary,button.danger', wrap); f && f.focus();
    if (f && f.select && f.tagName === 'INPUT') f.select();
  });
}
const confirmBox = async (title, html, ok = 'OK', danger = false) => (await modal({ title, body: html, buttons: [{ label: 'Cancel' }, { label: ok, value: 'ok', primary: !danger, danger }] }))?.btn === 'ok';
async function promptBox(title, label, value = '', ok = 'OK') {
  const r = await modal({ title, body: `<label class="f">${esc(label)}</label><input name="v" value="${esc(value)}"><div class="m-err msg err"></div>`, buttons: [{ label: 'Cancel' }, { label: ok, value: 'ok', primary: true, validate: v => v.v.trim() ? '' : 'Required' }] });
  return r ? r.v.trim() : null;
}
let menuEl = null;
function closeMenu() { if (menuEl) { menuEl.remove(); menuEl = null; } }
function popMenu(anchor, items) {
  closeMenu(); const r = anchor.getBoundingClientRect();
  const m = document.createElement('div'); m.className = 'pop';
  m.innerHTML = items.map((it, i) => `<button data-pi="${i}" class="${it.danger ? 'danger' : ''}" ${it.disabled ? 'disabled title="' + esc(it.disabled) + '"' : ''}>${esc(it.label)}</button>`).join('');
  document.body.appendChild(m);
  m.style.left = Math.min(r.left, innerWidth - m.offsetWidth - 8) + 'px'; m.style.top = Math.min(r.bottom + 4, innerHeight - m.offsetHeight - 8) + 'px';
  m.addEventListener('click', e => { e.stopPropagation(); const b = e.target.closest('[data-pi]'); if (b && !b.disabled) { closeMenu(); items[+b.dataset.pi].run(); } });
  menuEl = m;
}
document.addEventListener('mousedown', e => { if (menuEl && !menuEl.contains(e.target)) closeMenu(); });
