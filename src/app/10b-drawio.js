/* ================= draw.io export: pages at different depths ================= */
const DIO = {
  font: 'fontFamily=Segoe UI;',
  hex(rgb) { return '#' + rgb.match(/\d+/g).map(x => (+x).toString(16).padStart(2, '0')).join(''); },
  tint(c, t = .84) { return DIO.hex(mixHex(c || '#8b8d98', '#ffffff', t)); },
  dark(c) { return DIO.hex(mixHex(c || '#8b8d98', '#1b1b2a', .35)); },
};
const isPerson = o => o && (o.template === 'person' || /person|people/i.test(state.templates[o.template]?.name || ''));
const ownerRel = (r, o) => isPerson(state.objects.get(r.target)) || isPerson(o);
const topOf = o => folderSegs(o.folder)[0] || 'Objects';
const subOf = o => folderSegs(o.folder).slice(0, 2).join('/') || 'Objects';
const DIO_ORDER = ['business', 'process', 'software', 'service', 'saas', 'internal', 'devsecops', '3rd', 'third', 'ai', 'hardware', 'network', 'infra', 'reference'];
const dioRank = k => { const i = DIO_ORDER.findIndex(w => lc(k).includes(w)); return i < 0 ? 99 : i; };
const namesOfRel = (o, type) => o.relations.filter(r => r.type === type).map(r => state.objects.get(r.target)?.name).filter(Boolean);
const dioId = s => String(s).replace(/\W/g, '_');

class DioPage {
  constructor(name, title, subtitle) {
    this.name = name; this.cells = []; this.n = 0; this.oy = 0;
    if (title) { this.text(title, 0, 0, 1200, 30, 'fontSize=20;fontStyle=1;fontColor=#2b2a5c;'); if (subtitle) this.text(subtitle, 0, 30, 1600, 22, 'fontSize=12;fontColor=#6b6b80;'); this.oy = 90; }
  }
  id(p = 'c') { return p + (++this.n); }
  /* text cell; abs = page coordinates, otherwise below the title like every other cell */
  text(v, x, y, w, h, st = '', abs = true) { this.cells.push(`<mxCell id="${this.id('t')}" value="${xesc(v)}" style="text;html=1;align=left;verticalAlign=middle;fillColor=none;strokeColor=none;${DIO.font}${st}" vertex="1" parent="1"><mxGeometry x="${x}" y="${abs ? y : y + this.oy}" width="${w}" height="${h}" as="geometry"/></mxCell>`); }
  box(id, html, x, y, w, h, st, parent = '1', tip = '') { this.cells.push(`<mxCell id="${id}" value="${xesc(html)}" ${tip ? `tooltip="${xesc(tip)}"` : ''} style="whiteSpace=wrap;html=1;${DIO.font}${st}" vertex="1" parent="${parent}"><mxGeometry x="${Math.round(x)}" y="${Math.round(parent === '1' ? y + this.oy : y)}" width="${Math.round(w)}" height="${Math.round(h)}" as="geometry"/></mxCell>`); return id; }
  edge(s, t, st, label = '', pts = null) { this.cells.push(`<mxCell id="${this.id('e')}" value="${xesc(label)}" style="html=1;${DIO.font}fontSize=10;labelBackgroundColor=#ffffff;${st}" edge="1" parent="1" source="${s}" target="${t}"><mxGeometry relative="1" as="geometry">${pts ? `<Array as="points">${pts.map(([x, y]) => `<mxPoint x="${Math.round(x)}" y="${Math.round(y + this.oy)}"/>`).join('')}</Array>` : ''}</mxGeometry></mxCell>`); }
  xml(i) { return `<diagram id="p${i}" name="${xesc(this.name)}"><mxGraphModel dx="1600" dy="900" grid="0" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="0" pageScale="1" math="0" shadow="0"><root><mxCell id="0"/><mxCell id="1" parent="0"/>${this.cells.join('')}</root></mxGraphModel></diagram>`; }
}
const objBoxStyle = o => `rounded=1;arcSize=14;fontSize=11;fillColor=${DIO.tint(colorOf(o))};strokeColor=${colorOf(o)};strokeWidth=${isCrit(o) ? 2.4 : 1.1};`;
const objLabel = (o, sub = true) => `${xesc(iconOf(o))} <b>${xesc(o.name)}</b>${sub ? `<br><font style="font-size:9px" color="#666">${xesc(tplOf(o)?.name || 'Custom')}${isCrit(o) ? ' · <b>critical</b>' : ''}</font>` : ''}`;
const TREE = 'edgeStyle=orthogonalEdgeStyle;rounded=1;orthogonalLoop=1;exitX=0.5;exitY=1;exitDx=0;exitDy=0;entryX=0.5;entryY=0;entryDx=0;entryDy=0;';

/* ---- 1. overview: one box per top-level area, one arrow per pair of areas ---- */
function dioOverview(objs) {
  const pg = new DioPage('1 Overview', 'IT architecture: overview', 'Top-level areas of the register and how many links go between them (owners / people are not drawn).');
  const groups = [...groupBy(objs.filter(o => !isPerson(o)), topOf)];
  const rowOf = k => { const r = dioRank(k); return r <= 1 ? 0 : r <= 9 ? 1 : r <= 12 ? 2 : 3; };
  const keys = new Set(groups.map(g => g[0])), agg = new Map();
  for (const o of objs) for (const r of o.relations) {
    const t = state.objects.get(r.target); if (!t || ownerRel(r, o) || isPerson(t)) continue;
    const a = topOf(o), b = topOf(t); if (a === b || !keys.has(a) || !keys.has(b)) continue;
    const [p, q] = [a, b].sort(), k = p + '\u0000' + q, e = agg.get(k) || { p, q, n: 0, fw: 0, bw: 0, types: {} };
    e.n++; a === p ? e.fw++ : e.bw++; e.types[r.type] = (e.types[r.type] || 0) + 1; agg.set(k, e);
  }
  const rows = [0, 1, 2, 3].map(i => groups.filter(([k]) => rowOf(k) === i)).filter(r => r.length);
  const W = 250, H = 110, GX = 110, GY = 170, pos = new Map();
  const weight = (a, b) => (agg.get([a, b].sort().join('\u0000')) || { n: 0 }).n;
  rows.forEach((row, ri) => {
    if (ri) row.sort((x, y) => { const bc = k => { let s = 0, w = 0; for (const [p, v] of pos) { const n = weight(k, p); s += n * v.x; w += n; } return w ? s / w : 1e9; }; return bc(x[0]) - bc(y[0]); });
    else row.sort((x, y) => y[1].length - x[1].length);
    const skips = k => [...agg.values()].filter(e => (e.p === k || e.q === k) && Math.abs(rowOf(e.p) - rowOf(e.q)) > 1).length;
    const linked = k => [...agg.values()].some(e => e.p === k || e.q === k);
    if (row.length > 1) { const iso = row.filter(([k]) => !linked(k)), s = row.filter(([k]) => linked(k) && skips(k)), rest = row.filter(([k]) => linked(k) && !skips(k)); row.splice(0, row.length, ...iso, ...rest, ...s); }   // unlinked areas to one end, side-routed ones to the other
    const total = row.length * (W + GX) - GX;
    row.forEach(([k], i) => pos.set(k, { x: -total / 2 + i * (W + GX), y: ri * (H + GY), row: ri }));
  });
  const minX = Math.min(...[...pos.values()].map(p => p.x)), span = Math.max(...[...pos.values()].map(p => p.x)) + W - minX;
  const id = k => 'g' + dioId(k);
  for (const [k, l] of groups) {
    const byT = [...groupBy(l, o => tplOf(o)?.name || 'Custom')].sort((a, b) => b[1].length - a[1].length);
    const col = colorOf(l.find(o => (tplOf(o)?.name || 'Custom') === byT[0][0])), p = pos.get(k);
    pg.box(id(k), `<b style="font-size:15px">${xesc(k)}</b><br><font color="#555">${l.length} objects</font><br><font style="font-size:10px" color="#777">${byT.slice(0, 4).map(([t, x]) => `${xesc(t)} ${x.length}`).join(' · ')}${byT.length > 4 ? ' …' : ''}</font>`,
      p.x - minX, p.y, W, H, `rounded=1;arcSize=10;fillColor=${DIO.tint(col, .8)};strokeColor=${col};strokeWidth=2;shadow=1;`);
  }
  const lane = { l: 0, r: 0 };
  for (const e of [...agg.values()].sort((a, b) => b.n - a.n)) {
    const top = Object.entries(e.types).sort((x, y) => y[1] - x[1]), rt = relOf(top[0][0]);
    const label = top.slice(0, 3).map(([t, c]) => `${relOf(t).label} ${c}`).join('<br>') + (top.length > 3 ? '<br>…' : '');
    const [src, dst] = e.fw >= e.bw ? [e.p, e.q] : [e.q, e.p], a = pos.get(src), b = pos.get(dst);
    let st = `endArrow=block;endFill=1;${e.fw && e.bw ? 'startArrow=block;startFill=1;' : ''}strokeColor=${rt.color};strokeWidth=${(1.2 + Math.log2(e.n) * .7).toFixed(1)};fontColor=${DIO.dark(rt.color)};`, pts = null;
    if (Math.abs(a.row - b.row) > 1) {   // skip-level link: go around the side instead of through the boxes in between
      const clear = side => [a, b].every(p => ![...pos.values()].some(q => q.row === p.row && (side === 'l' ? q.x < p.x : q.x > p.x)));
      const left = clear('l') && !clear('r') ? true : clear('r') ? false : (a.x + b.x) / 2 - minX + W / 2 < span / 2;
      const x = left ? -60 - 40 * lane.l++ : span + 60 + 40 * lane.r++;
      st += `edgeStyle=none;exitX=${left ? 0 : 1};exitY=0.5;exitDx=0;exitDy=0;entryX=${left ? 0 : 1};entryY=0.5;entryDx=0;entryDy=0;`;
      pts = [[x, a.y + H / 2], [x, b.y + H / 2]];
    }
    pg.edge(id(src), id(dst), st, label, pts);
  }
  return pg;
}

/* ---- 2. landscape: a map of areas, sub-areas and their objects (no arrows) ---- */
function dioLandscape(objs) {
  const pg = new DioPage('2 Landscape', 'IT landscape', 'Where everything is: every object inside its area and sub-area. Links are on the Overview and the process pages.');
  const list = objs.filter(o => !isPerson(o));
  const tops = [...groupBy(list, topOf)].sort((a, b) => dioRank(a[0]) - dioRank(b[0]) || a[0].localeCompare(b[0]));
  const OW = 168, OH = 38, G = 10, PAD = 16, HEAD = 34, MAXW = 2000;
  let y = 0;
  for (const [top, items] of tops) {
    const subs = [...groupBy(items, subOf)].sort((a, b) => a[0].localeCompare(b[0]));
    const blocks = subs.map(([k, l]) => { const cols = Math.min(l.length, Math.max(2, Math.ceil(Math.sqrt(l.length * 1.6)))), rows = Math.ceil(l.length / cols); return { k, l, cols, w: cols * (OW + G) - G + 2 * PAD, h: HEAD + rows * (OH + G) - G + PAD }; });
    let x = PAD, rowY = HEAD + 6, rowH = 0, innerW = 0; const pos = [];
    for (const b of blocks) { if (x + b.w > MAXW && x > PAD) { x = PAD; rowY += rowH + 18; rowH = 0; } pos.push({ ...b, x, y: rowY }); x += b.w + 18; rowH = Math.max(rowH, b.h); innerW = Math.max(innerW, x); }
    const tid = 'a' + dioId(top), TW = innerW - 18 + PAD, TH = rowY + rowH + PAD;
    pg.box(tid, `<b>${xesc(top)}</b> <font color="#777">· ${items.length}</font>`, 0, y, TW, TH, 'rounded=1;arcSize=2;container=1;collapsible=0;verticalAlign=top;align=left;spacingLeft=12;spacingTop=6;fontSize=15;fillColor=#f4f5fb;strokeColor=#b8bcd6;strokeWidth=1.5;');
    for (const b of pos) {
      const single = b.k === top, sid = 's' + dioId(b.k);
      pg.box(sid, single ? '' : `<b>${xesc(b.k.split('/').at(-1))}</b> <font color="#777">· ${b.l.length}</font>`, b.x, b.y - (single ? 30 : 0), b.w, b.h + (single ? 30 : 0), `rounded=1;arcSize=3;container=1;collapsible=0;verticalAlign=top;align=left;spacingLeft=10;spacingTop=4;fontSize=12;fillColor=${single ? 'none' : '#ffffff'};strokeColor=${single ? 'none' : '#d2d5e6'};`, tid);
      b.l.sort((p, q) => (tplOf(p)?.name || '').localeCompare(tplOf(q)?.name || '') || p.name.localeCompare(q.name, undefined, { numeric: true }))
        .forEach((o, i) => pg.box('o' + dioId(o.id), objLabel(o, false), PAD + (i % b.cols) * (OW + G), HEAD + (single ? 30 : 0) + Math.floor(i / b.cols) * (OH + G), OW, OH, objBoxStyle(o) + 'fontSize=10;', sid, `${o.id} · ${tplOf(o)?.name || ''}`));
    }
    y += TH + 70;
  }
  return pg;
}

/* ---- 3. one page per business process: process → systems it uses (cards) → what each system connects to ---- */
function dioCard(o) {
  let extraLines = 0;
  const line = (ic, v) => { if (!v) return ''; extraLines += Math.ceil((v.length + 3) / 36); return `<br><font style="font-size:10px">${ic} ${xesc(v)}</font>`; };
  const env = fieldLike(o, /^env/i);
  const lines = [
    line('📍', namesOfRel(o, 'located_in').join(', ')), line('🏢', namesOfRel(o, 'supported_by').join(', ')),
    line('🖥', namesOfRel(o, 'runs_on').join(', ')), line('👔', namesOfRel(o, 'business_owner').join(', ')),
    line('🛠', namesOfRel(o, 'technical_owner').join(', ')), line('🔑', namesOfRel(o, 'access_manager').join(', '))].filter(Boolean);
  const html = `${xesc(iconOf(o))} <b>${xesc(o.name)}</b><br><font style="font-size:9px" color="#666">${xesc(tplOf(o)?.name || '')}${env ? ' · ' + xesc(env) : ''}${isCrit(o) ? ' · <b><font color="#c0392b">critical</font></b>' : ''}</font>${lines.join('')}`;
  return { html, h: 34 + Math.ceil((o.name.length + 3) / 30) * 15 + extraLines * 14 };
}
function dioProcess(bp, idx) {
  const sub = [isCrit(bp) && 'critical', namesOfRel(bp, 'business_owner').length && 'Business owner: ' + namesOfRel(bp, 'business_owner').join(', '), bp.fields['RTO'] && 'RTO ' + bp.fields['RTO'], bp.fields['RPO'] && 'RPO ' + bp.fields['RPO']].filter(Boolean);
  const pg = new DioPage(`3.${idx} ${bp.name}`.slice(0, 60), bp.name, ['Business process', ...sub].join(' · '));
  const used = bp.relations.filter(r => r.type === 'uses').map(r => state.objects.get(r.target)).filter(Boolean)
    .sort((a, b) => (isCrit(b) - isCrit(a)) || (tplOf(a)?.name || '').localeCompare(tplOf(b)?.name || '') || a.name.localeCompare(b.name));
  const CW = 220, GX = 26, cards = used.map(o => ({ o, ...dioCard(o) })), rowH = Math.max(60, ...cards.map(c => c.h));
  const totalW = Math.max(CW, cards.length * (CW + GX) - GX), BW = 300;
  const bpId = pg.box('bp', `${xesc(iconOf(bp))} <b style="font-size:14px">${xesc(bp.name)}</b><br><font style="font-size:10px" color="#666">${namesOfRel(bp, 'responsible_mgmt').length ? 'Responsible: ' + xesc(namesOfRel(bp, 'responsible_mgmt').join(', ')) : 'Business process'}</font>`, (totalW - BW) / 2, 0, BW, 60, `rounded=1;arcSize=18;fillColor=${DIO.tint(colorOf(bp), .75)};strokeColor=${colorOf(bp)};strokeWidth=2.5;shadow=1;`);
  let deepest = 0;
  cards.forEach((c, i) => {
    const id = pg.box('u' + i, c.html, i * (CW + GX), 130, CW, rowH, `${objBoxStyle(c.o)}align=left;verticalAlign=top;spacingLeft=8;spacingTop=6;spacingRight=6;`, '1', c.o.id);
    pg.edge(bpId, id, TREE + `endArrow=block;endFill=1;endSize=5;strokeColor=${relOf('uses').color};strokeWidth=1.4;`);
    // what this system connects to, stacked under it: short vertical links, no crossings
    const conn = c.o.relations.filter(r => ['connected_with', 'depends_on', 'uses'].includes(r.type)).map(r => ({ r, t: state.objects.get(r.target) })).filter(x => x.t && !isPerson(x.t) && x.t.id !== bp.id);
    let prev = id, y = 130 + rowH + 50;
    conn.forEach((x, j) => {
      const d = pg.box(`d${i}_${j}`, objLabel(x.t), i * (CW + GX) + 18, y, CW - 36, 40, objBoxStyle(x.t) + 'fontSize=10;', '1', `${x.t.id} · ${relOf(x.r.type).label}`);
      pg.edge(prev, d, TREE + `endArrow=block;endFill=1;endSize=4;dashed=1;strokeColor=${relOf(x.r.type).color};`, j ? '' : relOf(x.r.type).label); prev = d; y += 62;
    });
    deepest = Math.max(deepest, conn.length);
  });
  if (!cards.length) pg.box('none', '<i>No systems are linked to this process yet.</i><br><font style="font-size:10px" color="#777">Add them in the register: edit the process → Services.</font>', (totalW - BW) / 2, 110, BW, 54, 'rounded=1;dashed=1;fillColor=#fafafa;strokeColor=#bbbbbb;fontSize=11;');
  pg.text('📍 location  🏢 vendor  🖥 runs on  👔 business owner  🛠 technical owner  🔑 access manager · thick border = critical · dashed = what the system connects to',
    0, 130 + rowH + (deepest ? 50 + deepest * 62 + 10 : 40), 1100, 20, 'fontSize=10;fontColor=#8a8aa0;', false);
  return pg;
}

/* ---- 4. network topology: trees following "Connected to" ---- */
function dioNetwork(objs) {
  const set = new Set(objs.map(o => o.id)), parent = new Map(), kids = new Map();
  for (const o of objs) for (const r of o.relations) if (r.type === 'connected_to' && set.has(r.target) && !parent.has(o.id)) parent.set(o.id, r.target);
  const nodes = new Set([...parent.keys(), ...parent.values()]); if (!nodes.size) return null;
  for (const [c, p] of parent) { if (!kids.has(p)) kids.set(p, []); kids.get(p).push(c); }
  const pg = new DioPage('4 Network', 'Network topology', 'Following "Connected to": router → firewall → switches → access points / devices.');
  const W = 150, H = 44, GX = 18, GY = 70, nm = id => state.objects.get(id).name, nid = id => 'n' + dioId(id);
  const roots = [...nodes].filter(id => !parent.has(id) || !nodes.has(parent.get(id))).sort((a, b) => nm(a).localeCompare(nm(b), undefined, { numeric: true }));
  let x = 0; const seen = new Set();
  const lay = (id, depth) => {   // tidy tree: leaves left to right, parents centred over their children
    seen.add(id); const ch = (kids.get(id) || []).filter(c => !seen.has(c)).sort((a, b) => nm(a).localeCompare(nm(b), undefined, { numeric: true }));
    let cx;
    if (!ch.length) { cx = x; x += W + GX; } else { const xs = ch.map(c => lay(c, depth + 1)); cx = (xs[0] + xs.at(-1)) / 2; }
    const o = state.objects.get(id);
    pg.box(nid(id), `${objLabel(o, false)}<br><font style="font-size:9px" color="#666">${xesc(fieldLike(o, /^ip/i) || tplOf(o)?.name || '')}</font>`, cx, depth * (H + GY), W, H, objBoxStyle(o) + 'fontSize=10;', '1', o.id);
    for (const c of ch) pg.edge(nid(id), nid(c), TREE + 'endArrow=none;strokeColor=#e5484d;strokeWidth=1.4;');
    return cx;
  };
  for (const r of roots) { lay(r, 0); x += 60; }
  return pg;
}

/* ---- 5. around one object: direct links grouped by type; the next step as text inside each card ---- */
function dioAround(center, depth, withPeople) {
  const pg = new DioPage(`5 Around ${center.name}`.slice(0, 60), `Around ${center.name}`, `Everything directly linked to ${center.name}, grouped by type of link${depth > 1 ? '; ↳ lines inside each card show what that object links to next' : ''}.`);
  const links = [
    ...center.relations.map(r => ({ key: 'o:' + r.type, label: relOf(r.type).label, type: r.type, id: r.target })),
    ...(state.inbound.get(center.id) || []).map(r => ({ key: 'i:' + r.type, label: relOf(r.type).inverse, type: r.type, id: r.from }))]
    .filter(l => state.objects.has(l.id) && l.id !== center.id && (withPeople || !isPerson(state.objects.get(l.id))));
  const groups = [...groupBy(links, l => l.key)].sort((a, b) => b[1].length - a[1].length);
  const shown = new Set([center.id, ...links.map(l => l.id)]);
  const card = o => {
    const c = dioCard(o); if (depth < 2 || o === center) return c;
    const nxt = [...groupBy([...o.relations.map(r => ({ t: r.target, lab: relOf(r.type).label })), ...(state.inbound.get(o.id) || []).map(r => ({ t: r.from, lab: relOf(r.type).inverse }))]
      .filter(x => !shown.has(x.t) && state.objects.has(x.t) && !isPerson(state.objects.get(x.t))), x => x.lab)];
    let n = 0;
    const extra = nxt.slice(0, 4).map(([lab, l]) => { const t = `↳ ${lab}: ${l.slice(0, 4).map(x => state.objects.get(x.t).name).join(', ')}${l.length > 4 ? ` +${l.length - 4}` : ''}`; n += Math.ceil(t.length / 36); return `<br><font style="font-size:10px" color="#555">${xesc(t)}</font>`; }).join('');
    return { html: c.html + extra, h: c.h + n * 14 };
  };
  const CW = 230, GX = 30, PAD = 12, HEAD = 30;
  const cols = groups.map(([k, l]) => { const cs = l.map(x => ({ o: state.objects.get(x.id), ...card(state.objects.get(x.id)) })); return { l, cs, h: HEAD + cs.reduce((s, c) => s + c.h + 10, 0) + PAD }; });
  const totalW = Math.max(CW, cols.length * (CW + 2 * PAD + GX) - GX);
  const cc = card(center), cid = pg.box('center', cc.html, (totalW - 280) / 2, 0, 280, cc.h + 6, objBoxStyle(center) + 'strokeWidth=3;shadow=1;align=left;verticalAlign=top;spacingLeft=10;spacingTop=6;');
  cols.forEach((c, i) => {
    const l0 = c.l[0], rt = relOf(l0.type);
    const gid = pg.box('g' + i, `<b>${xesc(l0.label)}</b> <font color="#777">· ${c.l.length}</font>`, i * (CW + 2 * PAD + GX), cc.h + 90, CW + 2 * PAD, c.h, `rounded=1;arcSize=4;container=1;collapsible=0;verticalAlign=top;align=left;spacingLeft=10;spacingTop=4;fontSize=12;fillColor=${DIO.tint(rt.color, .9)};strokeColor=${rt.color};dashed=1;`);
    let y = HEAD;
    c.cs.forEach((x, j) => { pg.box(`g${i}_${j}`, x.html, PAD, y, CW, x.h, objBoxStyle(x.o) + 'align=left;verticalAlign=top;spacingLeft=8;spacingTop=5;', gid, x.o.id); y += x.h + 10; });
    pg.edge(cid, gid, TREE + `endArrow=block;endFill=1;strokeColor=${rt.color};strokeWidth=1.6;`);
  });
  return pg;
}

function buildDrawio(objs, opt = {}) {
  const pages = [];
  if (opt.overview !== false) pages.push(dioOverview(objs));
  if (opt.landscape !== false) pages.push(dioLandscape(objs));
  const pick = opt.processes instanceof Set ? opt.processes : null;
  if (opt.processes !== false) objs.filter(o => /process/i.test(o.template) && (pick ? pick.has(o.id) : o.relations.some(r => r.type === 'uses')))
    .sort((a, b) => (isCrit(b) - isCrit(a)) || a.name.localeCompare(b.name)).forEach((bp, i) => pages.push(dioProcess(bp, i + 1)));
  if (opt.network !== false) { const n = dioNetwork(objs); if (n) pages.push(n); }
  if (opt.around) pages.push(dioAround(opt.around, opt.depth || 2, opt.people));
  return `<mxfile host="Asterism" modified="${new Date().toISOString()}" type="device">${pages.map((p, i) => p.xml(i)).join('')}</mxfile>`;
}
