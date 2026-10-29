/* ================= storage backends ================= */
const notFound = e => e && (e.name === 'NotFoundError' || e.name === 'TypeMismatchError');

class RealFS {
  constructor(root) { this.root = root; this.kind = 'real'; this.name = root.name; }
  async _dir(path, create = false) { let d = this.root; for (const p of path) d = await d.getDirectoryHandle(p, { create }); return d; }
  async list(path) {
    let d; try { d = await this._dir(path); } catch (e) { if (notFound(e)) return []; throw e; }
    const out = []; for await (const [name, h] of d.entries()) out.push({ name, kind: h.kind }); return out;
  }
  async read(path) {
    const d = await this._dir(path.slice(0, -1)); const f = await (await d.getFileHandle(path.at(-1))).getFile();
    return { text: await f.text(), mtime: f.lastModified };
  }
  async mtime(path) {
    try { const d = await this._dir(path.slice(0, -1)); return (await (await d.getFileHandle(path.at(-1))).getFile()).lastModified; }
    catch (e) { if (notFound(e)) return null; throw e; }
  }
  async write(path, text) {
    const d = await this._dir(path.slice(0, -1), true); const fh = await d.getFileHandle(path.at(-1), { create: true });
    const w = await fh.createWritable(); await w.write(text); await w.close();
    return (await fh.getFile()).lastModified;
  }
  async remove(path, recursive = false) { const d = await this._dir(path.slice(0, -1)); await d.removeEntry(path.at(-1), { recursive }); }
  async mkdir(path) { await this._dir(path, true); }
  async isDir(path) { try { await this._dir(path); return true; } catch (e) { return false; } }
}

class MemFS {
  constructor(files) {
    this.kind = 'mem'; this.name = 'Demo data'; this.files = new Map(); this.dirs = new Set();
    const t = Date.now() - 3600e3; for (const [p, text] of Object.entries(files)) this._put(p, text, t);
  }
  _k(path) { return path.join('/'); }
  _put(k, text, mtime) { this.files.set(k, { text, mtime }); const s = k.split('/'); for (let i = 1; i < s.length; i++) this.dirs.add(s.slice(0, i).join('/')); }
  async list(path) {
    const pre = path.length ? this._k(path) + '/' : ''; const seen = new Map();
    for (const k of this.files.keys()) if (k.startsWith(pre)) { const r = k.slice(pre.length); const i = r.indexOf('/'); seen.set(i < 0 ? r : r.slice(0, i), i < 0 ? 'file' : 'directory'); }
    for (const d of this.dirs) if (d.startsWith(pre)) { const r = d.slice(pre.length); if (r && !r.includes('/')) seen.set(r, 'directory'); }
    return [...seen].map(([name, kind]) => ({ name, kind }));
  }
  async read(path) { const f = this.files.get(this._k(path)); if (!f) { const e = new Error('Not found: ' + this._k(path)); e.name = 'NotFoundError'; throw e; } return { text: f.text, mtime: f.mtime }; }
  async mtime(path) { const f = this.files.get(this._k(path)); return f ? f.mtime : null; }
  async write(path, text) { const k = this._k(path); const old = this.files.get(k); let mt = Date.now(); if (old && old.mtime >= mt) mt = old.mtime + 1; this._put(k, text, mt); return mt; }
  async remove(path) {
    const k = this._k(path); if (this.files.delete(k)) return;
    for (const f of [...this.files.keys()]) if (f.startsWith(k + '/')) this.files.delete(f);
    for (const d of [...this.dirs]) if (d === k || d.startsWith(k + '/')) this.dirs.delete(d);
  }
  async mkdir(path) { for (let i = 1; i <= path.length; i++) this.dirs.add(path.slice(0, i).join('/')); }
  async isDir(path) { return this.dirs.has(this._k(path)); }
}

async function copyDir(fs, src, dst) {
  await fs.mkdir(dst);
  for (const e of await fs.list(src)) {
    if (e.kind === 'directory') await copyDir(fs, [...src, e.name], [...dst, e.name]);
    else await fs.write([...dst, e.name], (await fs.read([...src, e.name])).text);
  }
}

/* remembered folder handle (IndexedDB) */
const idb = {
  open() { return new Promise((res, rej) => { const r = indexedDB.open('asterism', 1); r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); },
  async get(k) { const db = await this.open(); return new Promise((res, rej) => { const r = db.transaction('kv').objectStore('kv').get(k); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); },
  async set(k, v) { const db = await this.open(); return new Promise((res, rej) => { const tx = db.transaction('kv', 'readwrite'); tx.objectStore('kv').put(v, k); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); }); },
};
