/* ================= export: Excel (.xlsx) and draw.io ================= */
const CRC_T = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(b) { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = CRC_T[(c ^ b[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
function zipStore(files, type) {   // files: [{name, data: string|Uint8Array}] → Blob (stored, no compression)
  const enc = new TextEncoder(), parts = [], central = []; let off = 0;
  const d = new Date(), tm = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1), dt = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  for (const f of files) {
    const name = enc.encode(f.name), data = typeof f.data === 'string' ? enc.encode(f.data) : f.data, crc = crc32(data);
    const h = new DataView(new ArrayBuffer(30));
    [[0, 0x04034b50, 4], [4, 20, 2], [6, 0x0800, 2], [8, 0, 2], [10, tm, 2], [12, dt, 2], [14, crc, 4], [18, data.length, 4], [22, data.length, 4], [26, name.length, 2], [28, 0, 2]].forEach(([o, v, n]) => n === 4 ? h.setUint32(o, v, true) : h.setUint16(o, v, true));
    parts.push(new Uint8Array(h.buffer), name, data);
    const c = new DataView(new ArrayBuffer(46));
    [[0, 0x02014b50, 4], [4, 20, 2], [6, 20, 2], [8, 0x0800, 2], [10, 0, 2], [12, tm, 2], [14, dt, 2], [16, crc, 4], [20, data.length, 4], [24, data.length, 4], [28, name.length, 2], [30, 0, 2], [32, 0, 2], [34, 0, 2], [36, 0, 2], [38, 0, 4], [42, off, 4]].forEach(([o, v, n]) => n === 4 ? c.setUint32(o, v, true) : c.setUint16(o, v, true));
    central.push(new Uint8Array(c.buffer), name);
    off += 30 + name.length + data.length;
  }
  const size = central.reduce((s, a) => s + a.length, 0), e = new DataView(new ArrayBuffer(22));
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, size, true); e.setUint32(16, off, true);
  return new Blob([...parts, ...central, new Uint8Array(e.buffer)], { type });
}
const xesc = s => String(s ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const colName = i => { let s = ''; i++; while (i > 0) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; };
/** sheets: [{name, rows: [[cell]], header: true|false, widths?}] ; cell = string | number | {v, s} ; styles: 1 header, 2 body, 3 title, 4 bold */
function xlsxBlob(sheets) {
  const used = new Set();
  sheets.forEach(sh => { let n = String(sh.name).replace(/[\[\]:*?/\\]/g, '-').replace(/\s+/g, ' ').replace(/^'+|'+$/g, '').trim().slice(0, 31) || 'Sheet'; let b = n, i = 2; while (used.has(lc(n))) n = (b.slice(0, 28) + ' ' + i++); used.add(lc(n)); sh.name = n; });
  const ws = sh => {
    const rows = sh.rows, ncol = Math.max(1, ...rows.map(r => r.length));
    const widths = sh.widths || Array.from({ length: ncol }, (_, c) => Math.max(8, Math.min(60, Math.max(...rows.slice(0, 400).map(r => { const v = r[c]; const t = String(v && typeof v === 'object' ? v.v ?? '' : v ?? ''); return Math.max(...t.split('\n').map(x => x.length)); })) * 1.1 + 2)));
    const data = rows.map((r, ri) => `<row r="${ri + 1}">${r.map((c, ci) => {
      const ref = colName(ci) + (ri + 1); let v = c, s = sh.header !== false && ri === 0 ? 1 : 2;
      if (c && typeof c === 'object') { v = c.v; s = c.s ?? s; }
      if (v == null || v === '') return `<c r="${ref}" s="${s}"/>`;
      if (typeof v === 'number') return `<c r="${ref}" s="${s}"><v>${v}</v></c>`;
      return `<c r="${ref}" t="inlineStr" s="${s}"><is><t xml:space="preserve">${xesc(String(v).slice(0, 32000))}</t></is></c>`;
    }).join('')}</row>`).join('');
    const filt = sh.header !== false && rows.length > 1;
    sh._ref = `A1:${colName(ncol - 1)}${rows.length}`;
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheetViews><sheetView workbookViewId="0">${sh.header !== false ? '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>' : ''}</sheetView></sheetViews><sheetFormatPr defaultRowHeight="15"/><cols>${widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w.toFixed(1)}" customWidth="1"/>`).join('')}</cols><sheetData>${data}</sheetData>${filt ? `<autoFilter ref="${sh._ref}"/>` : ''}</worksheet>`;
  };
  const files = sheets.map((sh, i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, data: ws(sh) }));
  const n = sheets.length, X = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
  files.unshift(
    { name: '[Content_Types].xml', data: X + `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>` },
    { name: '_rels/.rels', data: X + `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>` },
    { name: 'docProps/core.xml', data: X + `<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>Asterism export</dc:title><dc:creator>Asterism</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString().replace(/\.\d+Z$/, 'Z')}</dcterms:created></cp:coreProperties>` },
    { name: 'xl/_rels/workbook.xml.rels', data: X + `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${n + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>` },
    { name: 'xl/styles.xml', data: X + `<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="4"><font><sz val="10"/><name val="Calibri"/><family val="2"/></font><font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Calibri"/><family val="2"/></font><font><b/><sz val="15"/><color rgb="FF2E2A6B"/><name val="Calibri"/><family val="2"/></font><font><b/><sz val="10"/><name val="Calibri"/><family val="2"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF3D3A80"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left/><right/><top/><bottom style="thin"><color rgb="FFDADAE3"/></bottom><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="5"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf><xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="0" fontId="3" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>` });
  const wb = X + `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView xWindow="0" yWindow="0" windowWidth="28800" windowHeight="16000"/></bookViews><sheets>${sheets.map((s, i) => `<sheet name="${xesc(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets><definedNames>${sheets.map((s, i) => s.header !== false && s.rows.length > 1 ? `<definedName name="_xlnm._FilterDatabase" localSheetId="${i}" hidden="1">'${xesc(s.name.replace(/'/g, "''"))}'!${s._ref.replace(/([A-Z]+)(\d+)/g, '$$$1$$$2')}</definedName>` : '').join('')}</definedNames></workbook>`;
  files.splice(4, 0, { name: 'xl/workbook.xml', data: wb });
  return zipStore(files, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
}

/* --- export data model helpers --- */
const relNames = (o, key) => o.relations.filter(r => r.type === key).map(r => r.target);
const inNames = (o, key) => (state.inbound.get(o.id) || []).filter(r => r.type === key).map(r => r.from);
/* first non-empty field whose name matches (e.g. any 'Critical…' or 'IP…' field) */
const fieldLike = (o, re) => { for (const k in o.fields) if (re.test(k) && String(o.fields[k] ?? '') !== '') return String(o.fields[k]); return ''; };
const critOf = o => { const v = fieldLike(o, /^critical/i); return v === 'true' ? 'Yes' : v === 'false' ? 'No' : v; };
const isCrit = o => { const v = lc(fieldLike(o, /^critical/i)); return v === 'true' || v === 'high' || v === 'critical' || v === 'yes'; };
const yesNo = v => v === 'true' ? 'Yes' : v === 'false' ? 'No' : v;
const B = v => ({ v, s: 4 });

function buildWorkbook(objs, scopeTitle) {
  const ids = new Set(objs.map(o => o.id)), sheets = [];
  const byTpl = groupBy(objs, o => o.template);
  const tplsUsed = [...byTpl.keys()].sort((a, b) => (state.templates[a]?.name || a).localeCompare(state.templates[b]?.name || b));
  // per-type sheets
  const typeSheets = tplsUsed.map(k => {
    const tpl = state.templates[k] || { name: k || 'Custom objects', fields: [] }; const list = byTpl.get(k).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    const tf = tpl.fields, tl = new Set(tf.map(f => f.label));
    const custom = [...new Set(list.flatMap(o => Object.keys(o.fields).filter(x => !tl.has(x))))];
    const head = ['ID', 'Name', 'Folder', 'Tags', ...tf.map(f => f.label), ...custom, 'Other relations', 'Incoming relations', 'Notes', 'Created', 'Updated'];
    const rows = [head, ...list.map(o => {
      const A = assignRefs(o.relations, o.template, o.customFields);
      const rest = [...groupBy(A.rest, r => r.type)].map(([t, rs]) => `${relOf(t).label}: ${namesOf(rs.map(r => r.target))}`).join('\n');
      const inc = [...groupBy(state.inbound.get(o.id) || [], r => r.type)].map(([t, rs]) => `${relOf(t).inverse}: ${namesOf(rs.map(r => r.from))}`).join('\n');
      return [o.id, B(o.name), folderLabel(o.folder), o.tags.join(', '),
        ...tf.map(f => f.type === 'ref' ? namesOf((A.byField.get(f.label) || []).map(r => r.target)) : f.type === 'boolean' ? yesNo(o.fields[f.label] ?? '') : (o.fields[f.label] ?? '')),
        ...custom.map(c => o.fields[c] ?? ''), rest, inc, o.notes, fmtStamp(o.created), fmtStamp(o.updated)];
    })];
    const w = head.map((h, i) => i === 0 ? 11 : i === 1 ? 30 : h === 'Notes' || /relations/.test(h) ? 45 : null);
    return { name: tpl.name, rows, widths: undefined, _w: w };
  });
  // relations
  const relRows = [['From ID', 'From', 'From type', 'Relation', 'To ID', 'To', 'To type', 'Category']];
  for (const o of objs) for (const r of o.relations) { const t = state.objects.get(r.target); relRows.push([o.id, B(o.name), tplOf(o)?.name || o.template, relOf(r.type).label, r.target, t?.name || '(missing)', t ? tplOf(t)?.name || t.template : '', relOf(r.type).category || '']); }
  // ownership (relations pointing to people)
  const personTpl = new Set(Object.values(state.templates).filter(t => t.key === 'person' || /person|people/i.test(t.name)).map(t => t.key));
  const pTypes = []; const seenT = new Set();
  for (const t of Object.values(state.templates)) for (const f of t.fields) if (f.type === 'ref' && personTpl.has(f.target) && !seenT.has(f.relation)) { seenT.add(f.relation); pTypes.push(f.relation); }
  for (const o of state.objects.values()) for (const r of o.relations) if (personTpl.has(state.objects.get(r.target)?.template) && !seenT.has(r.type)) { seenT.add(r.type); pTypes.push(r.type); }
  const ownRows = [['ID', 'Name', 'Type', 'Criticality', ...pTypes.map(t => relOf(t).label), 'Gaps']];
  for (const o of objs) {
    if (personTpl.has(o.template)) continue;
    const tplRefs = (tplOf(o)?.fields || []).filter(f => f.type === 'ref' && personTpl.has(f.target));
    const vals = pTypes.map(t => namesOf(relNames(o, t)));
    if (!tplRefs.length && vals.every(v => !v)) continue;
    const gaps = tplRefs.filter(f => !o.relations.some(r => r.type === f.relation)).map(f => `no ${f.label}`).join(', ');
    ownRows.push([o.id, B(o.name), tplOf(o)?.name || o.template, critOf(o), ...vals, gaps]);
  }
  // dependency chain: business process → used objects → hosting → vendor
  const bps = objs.filter(o => /process/i.test(o.template));
  const depRows = [['Business process', 'Process critical', 'Process business owner', 'Depends on', 'Type', 'Critical', 'Environment', 'Location / data centre', 'Runs on', 'Vendor', 'Business owner', 'Technical owner']];
  for (const bp of bps.sort((a, b) => a.name.localeCompare(b.name))) {
    const used = relNames(bp, 'uses').map(id => state.objects.get(id)).filter(Boolean);
    if (!used.length) depRows.push([B(bp.name), critOf(bp), namesOf(relNames(bp, 'business_owner')), '', '', '', '', '', '', '', '', '']);
    for (const s of used.sort((a, b) => a.name.localeCompare(b.name))) depRows.push([B(bp.name), critOf(bp), namesOf(relNames(bp, 'business_owner')), s.name, tplOf(s)?.name || s.template, critOf(s), fieldLike(s, /^env/i), namesOf(relNames(s, 'located_in')), namesOf(relNames(s, 'runs_on')), namesOf(relNames(s, 'supported_by')), namesOf(relNames(s, 'business_owner')), namesOf(relNames(s, 'technical_owner'))]);
  }
  // ICT third-party providers (DORA register-of-information helper)
  const vendors = objs.filter(o => o.template === 'vendor');
  const provRows = [['Provider', 'Critical provider', 'Website', 'Contract owner', 'Support contact', 'Provides / supports (objects)', 'Objects count', 'Data centres', 'Objects in their data centres', 'Licenses', 'Business processes supported', 'Critical business processes supported']];
  for (const v of vendors.sort((a, b) => a.name.localeCompare(b.name))) {
    const sup = inNames(v, 'supported_by').map(id => state.objects.get(id)).filter(Boolean);
    const dcs = sup.filter(x => /data-?cent/i.test(x.template)); const lic = sup.filter(x => x.template === 'license'); const other = sup.filter(x => !dcs.includes(x) && !lic.includes(x));
    const inDc = dcs.flatMap(dc => inNames(dc, 'located_in')).map(id => state.objects.get(id)).filter(Boolean);
    const all = [...new Set([...other, ...inDc])];
    const procs = [...new Set(all.flatMap(x => inNames(x, 'uses')))].map(id => state.objects.get(id)).filter(p => p && /process/i.test(p.template));
    provRows.push([B(v.name), yesNo(v.fields['Critical service provider'] ?? ''), v.fields['Website'] || '', namesOf(relNames(v, 'contract_owner')), namesOf(relNames(v, 'support_contact').concat(relNames(v, 'contact'))),
      other.map(x => x.name).sort().join('; '), other.length, dcs.map(x => x.name).join('; '), inDc.map(x => x.name).sort().join('; '), lic.map(x => x.name).join('; '),
      procs.map(p => p.name).sort().join('; '), procs.filter(isCrit).map(p => p.name).sort().join('; ')]);
  }
  const probRows = [['Severity', 'Object', 'Problem'], ...state.problems.filter(p => !p.id || ids.has(p.id)).map(p => [p.sev === 'err' ? 'Error' : 'Warning', p.id ? (state.objects.get(p.id)?.name || p.id) : '', p.msg])];
  // summary
  const sum = [[{ v: 'Asterism export', s: 3 }], ['Exported', nowStamp().replace('T', ' ')], ['Register', state.fs.name], ['Scope', scopeTitle], ['Objects', objs.length], ['Relations', relRows.length - 1], [],
    [B('Type'), B('Objects'), B('Critical')], ...tplsUsed.map(k => [state.templates[k]?.name || k, byTpl.get(k).length, byTpl.get(k).filter(isCrit).length]), [],
    [B('Sheet'), B('Contents')],
    ['<type> sheets', 'One sheet per object type: all fields, owners, other relations, notes'],
    ['Relations', 'Every link between objects (from → relation → to)'],
    ['Ownership', 'Business / technical owners and other people per object; "Gaps" lists missing owners'],
    ['Dependencies', 'Business process → systems/services it uses → location, host, vendor, owners'],
    ['ICT providers', 'Per vendor: what they provide, data centres, licenses, which (critical) business processes depend on them. Helper for DORA register of information and audits'],
    ['Problems', 'Broken links, duplicates and other data issues']];
  sheets.push({ name: 'Summary', rows: sum, header: false, widths: [26, 70, 12] });
  if (depRows.length > 1) sheets.push({ name: 'Dependencies', rows: depRows });
  if (provRows.length > 1) sheets.push({ name: 'ICT providers', rows: provRows });
  if (ownRows.length > 1) sheets.push({ name: 'Ownership', rows: ownRows });
  sheets.push({ name: 'Relations', rows: relRows });
  typeSheets.forEach(s => sheets.push({ name: s.name, rows: s.rows }));
  sheets.push({ name: 'Problems', rows: probRows });
  return sheets;
}

async function exportDialog() {
  const scoped = state.view === 'graph' && FG ? (state.graph.mode === 'tree' ? [...state.objects.values()].filter(o => { const f = state.graph.expandedRoot || ''; return !f || o.folder === f || o.folder.startsWith(f + '/'); }) : FG.graphData().nodes.filter(n => n.o).map(n => n.o)) : filteredObjects();
  const scopeName = state.view === 'graph' && state.graph.local ? `Graph around ${state.objects.get(state.selectedId)?.name || ''}` : filterTitle() + (state.search ? ` + search "${state.search}"` : '');
  const sel = state.objects.get(state.selectedId);
  const bps = [...state.objects.values()].filter(o => /process/i.test(o.template)).map(o => ({ o, n: o.relations.filter(r => r.type === 'uses').length }))
    .sort((a, b) => (b.n > 0) - (a.n > 0) || (isCrit(b.o) - isCrit(a.o)) || a.o.name.localeCompare(b.o.name));
  const nbp = bps.filter(b => b.n).length;
  let bpSel = new Set(bps.filter(b => b.n).map(b => b.o.id));
  const r = await modal({ title: 'Export', wide: true, body: `
    <label class="f">Format</label>
    <label class="chk"><input type="radio" name="fmt" value="xlsx" checked> <span><b>Excel workbook (.xlsx)</b>: summary, dependencies, ICT providers, ownership, relations, one sheet per type, problems</span></label><br>
    <label class="chk" style="margin-top:6px"><input type="radio" name="fmt" value="drawio"> <span><b>Architecture diagram (.drawio)</b>: several pages from overview to detail; open at app.diagrams.net or in draw.io</span></label>
    <div id="x-opt"><label class="f">Objects</label>
      <label class="chk"><input type="radio" name="scope" value="all" checked> Whole register (${state.objects.size})</label><br>
      <label class="chk" style="margin-top:6px"><input type="radio" name="scope" value="cur"> Current view: ${esc(scopeName)} (${scoped.length})</label></div>
    <div id="dio-opt" style="display:none"><label class="f">Pages (from overview to detail)</label>
      <div class="dio-pages">
        <label class="chk"><input type="checkbox" name="p_overview" checked> <span><b>1 · Overview</b><small>Areas only, one arrow per pair with the number of links</small></span></label>
        <label class="chk"><input type="checkbox" name="p_landscape" checked> <span><b>2 · Landscape</b><small>Map of all objects inside their areas and sub-areas</small></span></label>
        <label class="chk"><input type="checkbox" name="p_processes" checked> <span style="flex:1"><b>3 · Business processes</b><small>One page per chosen process: systems it uses with location, vendor, host and owners</small>
          <div class="bp-pick"><div class="bp-bar"><span id="bp-cnt"></span><span style="flex:1"></span><a data-bp="with">with systems (${nbp})</a> · <a data-bp="all">all (${bps.length})</a> · <a data-bp="none">none</a></div>
          <div class="bp-list">${bps.map(b => `<label class="chk"><input type="checkbox" class="bpc" value="${esc(b.o.id)}" ${b.n ? 'checked' : ''}> <span class="${b.n ? '' : 'dim'}">${esc(b.o.name)}</span>${isCrit(b.o) ? ' <span class="crit">critical</span>' : ''}<span class="dim" style="margin-left:auto">${b.n ? b.n + ' system' + (b.n > 1 ? 's' : '') : 'no systems linked'}</span></label>`).join('')}</div></div></span></label>
        <label class="chk"><input type="checkbox" name="p_network" checked> <span><b>4 · Network</b><small>Router → firewall → switches → access points</small></span></label>
        <label class="chk"><input type="checkbox" name="p_around" ${sel ? '' : 'disabled'}> <span><b>5 · Around ${sel ? esc(sel.name) : 'the selected object'}</b><small>${sel ? `Direct links grouped by type, <select name="depth" style="width:auto;padding:1px 6px"><option value="1">only direct links</option><option value="2" selected>+ next step inside each card</option></select> · <label class="chk" style="display:inline-flex"><input type="checkbox" name="people"> with people</label>` : 'Select an object first'}</small></span></label>
      </div>
      <p class="note">People and owner links are shown as text inside the cards, not as arrows, so the diagrams stay readable.</p></div>`,
    buttons: [{ label: 'Cancel' }, { label: 'Download', value: 'ok', primary: true }],
    onOpen: w => {
      const cnt = () => { bpSel = new Set($$('.bpc:checked', w).map(c => c.value)); const n = bpSel.size; $('#bp-cnt', w).textContent = `${n} page${n === 1 ? '' : 's'}`; $('[name=p_processes]', w).checked = n > 0; };
      w.addEventListener('change', e => { const d = $('[name=fmt]:checked', w).value === 'drawio'; $('#dio-opt', w).style.display = d ? '' : 'none'; $('#x-opt', w).style.display = d ? 'none' : ''; if (e.target.classList.contains('bpc')) cnt(); if (e.target.name === 'p_processes') { $$('.bpc', w).forEach(c => c.checked = e.target.checked && bps.find(b => b.o.id === c.value).n > 0); cnt(); } });
      w.addEventListener('click', e => { const a = e.target.closest('[data-bp]'); if (!a) return; e.preventDefault(); $$('.bpc', w).forEach(c => c.checked = a.dataset.bp === 'all' || (a.dataset.bp === 'with' && bps.find(b => b.o.id === c.value).n > 0)); cnt(); });
      cnt();
    } });
  if (!r) return;
  try {
    if (r.fmt === 'drawio') {
      const opt = { overview: r.p_overview, landscape: r.p_landscape, processes: r.p_processes && bpSel.size ? bpSel : false, network: r.p_network, around: r.p_around && sel ? sel : null, depth: +r.depth || 2, people: r.people };
      if (!opt.overview && !opt.landscape && !opt.processes && !opt.network && !opt.around) { toast('Choose at least one page', 'warn'); return; }
      download(new Blob([buildDrawio([...state.objects.values()], opt)], { type: 'application/xml' }), `asterism-architecture-${fileStamp()}.drawio`);
    } else download(xlsxBlob(buildWorkbook(r.scope === 'cur' ? scoped : [...state.objects.values()], r.scope === 'cur' ? scopeName : 'Whole register')), `asterism-${fileStamp()}.xlsx`);
    toast('Export ready', 'ok');
  } catch (e) { console.error(e); toast('Export failed: ' + esc(e.message), 'err'); }
}
