/* ===== core: parsing & serialization (shared by the app and the demo-data generator) ===== */
var FIELD_TYPES = ['text', 'multiline', 'ip', 'url', 'date', 'number', 'select', 'boolean', 'ref'];
var FAILSAFE_OPTS = { schema: jsyaml.FAILSAFE_SCHEMA, lineWidth: -1, noRefs: true };

function str(v) { return v == null ? '' : (typeof v === 'object' ? JSON.stringify(v) : String(v)); }
function arr(v) { return Array.isArray(v) ? v : (v == null || v === '' ? [] : [v]); }
function truthy(v) { return v === true || v === 'true' || v === 'yes' || v === 1 || v === '1'; }

/* --- object files (.md with YAML frontmatter) --- */
function parseMd(text) {
  text = String(text).replace(/^﻿/, '');
  var m = text.match(/^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)([\s\S]*)$/);
  if (!m) throw new Error('No YAML frontmatter (file must start with ---)');
  var fm = jsyaml.load(m[1], { schema: jsyaml.FAILSAFE_SCHEMA }) || {};
  if (typeof fm !== 'object' || Array.isArray(fm)) throw new Error('Frontmatter is not a key: value map');
  return { fm: fm, body: m[2].replace(/^\s*\r?\n/, '').replace(/\s+$/, '') };
}

function toObj(fm, body) {
  var extra = {};
  for (var k in fm) if (['id', 'name', 'template', 'icon', 'color', 'tags', 'created', 'updated', 'fields', 'custom_fields', 'relations'].indexOf(k) < 0) extra[k] = fm[k];
  var fields = {};
  if (fm.fields && typeof fm.fields === 'object' && !Array.isArray(fm.fields)) {
    for (var f in fm.fields) { var v = fm.fields[f]; fields[f] = Array.isArray(v) ? v.map(str).join(', ') : str(v); }
  }
  return {
    id: str(fm.id).trim(),
    name: str(fm.name).trim(),
    template: str(fm.template).trim(),
    icon: str(fm.icon).trim(), color: str(fm.color).trim(),
    customFields: normFieldDefs(fm.custom_fields),
    tags: arr(fm.tags).map(function (t) { return str(t).trim(); }).filter(Boolean),
    created: str(fm.created), updated: str(fm.updated),
    fields: fields,
    relations: arr(fm.relations).filter(function (r) { return r && typeof r === 'object' && !Array.isArray(r); })
      .map(function (r) { return { type: str(r.type).trim(), target: str(r.target).trim() }; })
      .filter(function (r) { return r.type && r.target; }),
    notes: body || '',
    extra: extra
  };
}

function serialize(o, templates) {
  var d = function (x, more) { return jsyaml.dump(x, Object.assign({}, FAILSAFE_OPTS, more || {})); };
  var s = '---\n';
  s += d({ id: o.id, name: o.name, template: o.template || '' });
  if (o.icon) s += d({ icon: o.icon });
  if (o.color) s += d({ color: o.color });
  s += 'tags: ' + d(o.tags || [], { flowLevel: 0 }).trim() + '\n';
  if (o.created) s += d({ created: o.created });
  if (o.updated) s += d({ updated: o.updated });
  var tpl = templates && templates[o.template];
  var tplFields = {};
  (tpl ? tpl.fields : []).concat(o.customFields || []).forEach(function (f) { tplFields[f.label] = 1; });
  var fields = {}, n = 0;
  for (var k in o.fields) {
    var v = o.fields[k] == null ? '' : String(o.fields[k]);
    if (v !== '' || !tplFields[k]) { fields[k] = v; n++; }   // empty template fields are not written
  }
  if (n) s += d({ fields: fields });
  if (o.customFields && o.customFields.length) s += 'custom_fields:\n' + o.customFields.map(function (f) {
    return '  - ' + jsyaml.dump(dumpFieldDef(f), { schema: jsyaml.JSON_SCHEMA, flowLevel: 0, lineWidth: -1 }).trim(); }).join('\n') + '\n';
  if (o.relations && o.relations.length) {
    s += 'relations:\n' + o.relations.map(function (r) {
      return '  - ' + d({ type: r.type, target: r.target }, { flowLevel: 0 }).trim();
    }).join('\n') + '\n';
  }
  if (o.extra && Object.keys(o.extra).length) s += d(o.extra);
  s += '---\n';
  if (o.notes && o.notes.trim()) s += '\n' + o.notes.trim() + '\n';
  return s;
}

/* --- templates --- */
function normTemplate(key, t) {
  t = t || {};
  return {
    key: key,
    name: str(t.name) || key,
    prefix: str(t.prefix || key).toLowerCase(),
    icon: str(t.icon) || '📄',
    color: str(t.color) || '#8b8d98',
    fields: arr(t.fields).map(function (f) { return typeof f === 'string' ? { label: f } : (f || {}); }).map(function (f) {
      var u = str(f.unique);
      return {
        label: str(f.label).trim(),
        type: FIELD_TYPES.indexOf(f.type) >= 0 ? f.type : 'text',
        required: truthy(f.required),
        unique: u === 'warn' || u === 'strict' ? u : (truthy(f.unique) ? 'warn' : ''),
        reset_on_copy: truthy(f.reset_on_copy),
        options: arr(f.options).map(str),
        relation: str(f.relation),           // ref fields: relation type key
        target: str(f.target),               // ref fields: target template key ('' = any)
        multiple: f.multiple == null ? true : truthy(f.multiple)
      };
    }).filter(function (f) { return f.label; }),
    relations: arr(t.relations).map(function (r) { return { type: str(r && r.type), target: str(r && r.target) }; })
      .filter(function (r) { return r.type; })
  };
}

function normFieldDefs(list) { return normTemplate('x', { fields: arr(list) }).fields; }
function dumpFieldDef(f) {
  var x = { label: f.label };
  if (f.type && f.type !== 'text') x.type = f.type;
  if (f.required) x.required = true;
  if (f.unique) x.unique = f.unique;
  if (f.reset_on_copy) x.reset_on_copy = true;
  if (f.type === 'select' && f.options && f.options.length) x.options = f.options;
  if (f.type === 'ref') { x.relation = f.relation; if (f.target) x.target = f.target; if (!f.multiple) x.multiple = false; }
  return x;
}
function dumpTemplate(t) {
  var o = { name: t.name, prefix: t.prefix, icon: t.icon, color: t.color };
  o.fields = t.fields.map(dumpFieldDef);
  if (t.relations && t.relations.length) o.relations = t.relations.map(function (r) {
    var x = { type: r.type }; if (r.target) x.target = r.target; return x;
  });
  return '# Template "' + t.name + '". Edit in the app (Settings) or by hand.\n' +
    jsyaml.dump(o, { schema: jsyaml.JSON_SCHEMA, lineWidth: -1, flowLevel: 2, noRefs: true });
}

/* --- relation types --- */
function normRelTypes(r) {
  var out = {};
  if (r && typeof r === 'object') for (var k in r) {
    var v = r[k] || {};
    out[k] = { key: k, label: str(v.label) || k, inverse: str(v.inverse) || ('← ' + (str(v.label) || k)), color: str(v.color) || '#8b8d98', category: str(v.category) };
  }
  return out;
}

function dumpRelTypes(rt) {
  var o = {};
  Object.keys(rt).forEach(function (k) {
    var v = rt[k]; o[k] = { label: v.label, inverse: v.inverse, color: v.color };
    if (v.category) o[k].category = v.category;
  });
  return '# Relation types: key: {label (outgoing), inverse (incoming), color, category}\n' +
    jsyaml.dump(o, { schema: jsyaml.JSON_SCHEMA, lineWidth: -1, flowLevel: 1, noRefs: true });
}
