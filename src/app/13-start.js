/* ================= start ================= */
(async function start() {
  applyAppearance();
  if (prefs.graph) { const p = prefs.graph; Object.assign(state.graph, { ...p, hidden: new Set(p.hidden || []) }); }
  try {
    const h = await idb.get('root');
    if (h) { state.storedHandle = h; if (await h.queryPermission({ mode: 'readwrite' }) === 'granted') return openFS(new RealFS(h)); }
  } catch (e) { /* IndexedDB unavailable */ }
  renderWelcome();
})();

window.__reg = { state, openFS, RealFS, MemFS, loadRegister, buildWorkbook, buildDrawio, openPicker, get fg() { return FG; } };
