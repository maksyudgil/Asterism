// Generates the demo register (all data fictional) into ./demo and dist/demo-files.json (embedded into register.html)
const fs = require('fs');
const path = require('path');
globalThis.jsyaml = require('js-yaml');
(0, eval)(fs.readFileSync(path.join(__dirname, 'src/core.js'), 'utf8'));

const OUT = path.join(__dirname, 'demo');
const files = {};
const put = (p, text) => { files[p] = text; };

/* ---------- relation types ---------- */
const relTypes = normRelTypes({
  connected_to: { label: 'Connected to', inverse: 'Connected devices', color: '#e5484d', category: 'Technical' },
  runs_on:      { label: 'Runs on', inverse: 'Hosts', color: '#f76b15', category: 'Technical' },
  depends_on:   { label: 'Depends on', inverse: 'Required by', color: '#f5d90a', category: 'Dependency' },
  uses:         { label: 'Uses', inverse: 'Used by', color: '#12a594', category: 'Dependency' },
  supported_by: { label: 'Supported by', inverse: 'Supports', color: '#3e9bff', category: 'Reference' },
  contact:      { label: 'Contact person', inverse: 'Contact for', color: '#30a46c', category: 'Link' },
  business_owner: { label: 'Business owner', inverse: 'Business owner of', color: '#8e4ec6', category: 'Reference' },
  technical_owner: { label: 'Technical owner', inverse: 'Technical owner of', color: '#c084fc', category: 'Reference' },
  linked_with:  { label: 'Linked with', inverse: 'Linked with', color: '#46a758', category: 'Link' },
  licensed_by:  { label: 'Licensed by', inverse: 'License for', color: '#d6409f', category: 'Financial' },
  located_in:   { label: 'Located in', inverse: 'Location of', color: '#8b8d98', category: 'Reference' },
});
put('_relations.yaml', dumpRelTypes(relTypes));

/* ---------- templates ---------- */
const STATUS = { label: 'Status', type: 'select', options: ['Active', 'Spare', 'Retired'] };
const CRIT = { label: 'Criticality', type: 'select', options: ['Low', 'Medium', 'High', 'Critical'] };
const HOST = { label: 'Hostname', unique: 'warn', reset_on_copy: true };
const IP = { label: 'IP Address', type: 'ip', unique: 'warn', reset_on_copy: true };
const SN = { label: 'Serial/MAC', unique: 'strict', reset_on_copy: true };
const TO = { label: 'Technical owner', type: 'ref', relation: 'technical_owner', target: 'person' };
const BO = { label: 'Business owner', type: 'ref', relation: 'business_owner', target: 'person' };
const VEN = { label: 'Vendor', type: 'ref', relation: 'supported_by', target: 'vendor', multiple: false };
const LOC = { label: 'Location', type: 'ref', relation: 'located_in', target: 'location', multiple: false };
const T = {
  firewall: { name: 'Firewall', prefix: 'fw', icon: '🛡️', color: '#ef4444',
    fields: [HOST, IP, SN, { label: 'Model' }, { label: 'Firmware' }, STATUS, TO, LOC, VEN, { label: 'Purchase date', type: 'date' }, { label: 'Warranty until', type: 'date' }],
    relations: [] },
  switch: { name: 'Switch', prefix: 'sw', icon: '🔀', color: '#3b82f6',
    fields: [HOST, IP, SN, { label: 'Model' }, { label: 'Ports', type: 'number' }, STATUS, TO, LOC, VEN, { label: 'Purchase date', type: 'date' }],
    relations: [{ type: 'connected_to', target: 'switch' }, { type: 'connected_to', target: 'firewall' }] },
  'wifi-ap': { name: 'Wi-Fi access point', prefix: 'ap', icon: '📶', color: '#06b6d4',
    fields: [HOST, IP, SN, { label: 'Model' }, { label: 'SSIDs' }, STATUS, TO, LOC],
    relations: [{ type: 'connected_to', target: 'switch' }] },
  server: { name: 'Server', prefix: 'srv', icon: '🖥️', color: '#8b5cf6',
    fields: [HOST, IP, SN, { label: 'Kind', type: 'select', options: ['Physical', 'Virtual'] }, { label: 'OS' }, { label: 'CPU / RAM' }, STATUS, CRIT, TO, { label: 'Runs on', type: 'ref', relation: 'runs_on', target: 'server', multiple: false }, LOC],
    relations: [{ type: 'connected_to', target: 'switch' }] },
  printer: { name: 'Printer', prefix: 'prn', icon: '🖨️', color: '#64748b',
    fields: [HOST, IP, SN, { label: 'Model' }, STATUS, TO, LOC],
    relations: [{ type: 'connected_to', target: 'switch' }] },
  service: { name: 'Service', prefix: 'svc', icon: '⚙️', color: '#22c55e',
    fields: [{ label: 'Hosting', type: 'select', required: true, options: ['Cloud (SaaS)', 'On-premises', 'Vendor-hosted'] }, { label: 'URL', type: 'url' }, CRIT, STATUS, BO, TO, VEN, { label: 'Runs on', type: 'ref', relation: 'runs_on', target: 'server' }, { label: 'License', type: 'ref', relation: 'licensed_by', target: 'license' }, { label: 'SLA', type: 'boolean' }, { label: 'SLA details', type: 'multiline' }],
    relations: [{ type: 'depends_on', target: 'service' }] },
  'business-process': { name: 'Business process', prefix: 'bp', icon: '💼', color: '#f59e0b',
    fields: [{ label: 'Description', type: 'multiline' }, CRIT, BO, { label: 'Services', type: 'ref', relation: 'uses', target: 'service' }, { label: 'RTO' }, { label: 'RPO' }],
    relations: [] },
  vendor: { name: 'Vendor', prefix: 'ven', icon: '🏢', color: '#ec4899',
    fields: [{ label: 'Registry code', unique: 'strict', reset_on_copy: true }, { label: 'Website', type: 'url' }, { label: 'Support phone' }, { label: 'Support email' }, { label: 'Contract number', unique: 'warn', reset_on_copy: true }, { label: 'Contract until', type: 'date' }, { label: 'Contact person', type: 'ref', relation: 'contact', target: 'person' }],
    relations: [] },
  person: { name: 'Person', prefix: 'per', icon: '👤', color: '#a3e635',
    fields: [{ label: 'Role' }, { label: 'Email', unique: 'warn', reset_on_copy: true }, { label: 'Phone', reset_on_copy: true }],
    relations: [] },
  license: { name: 'License', prefix: 'lic', icon: '🔑', color: '#eab308',
    fields: [{ label: 'Product' }, { label: 'Quantity', type: 'number' }, { label: 'Renewal date', type: 'date' }, { label: 'Cost / year' }, { label: 'Contract number' }, VEN],
    relations: [] },
  location: { name: 'Location', prefix: 'loc', icon: '📍', color: '#94a3b8',
    fields: [{ label: 'Address', type: 'multiline' }, { label: 'Floor / room' }, { label: 'Part of', type: 'ref', relation: 'located_in', target: 'location', multiple: false }],
    relations: [] },
};
const templates = {};
for (const [k, t] of Object.entries(T)) { templates[k] = normTemplate(k, t); put(`_templates/${k}.yaml`, dumpTemplate(templates[k])); }

/* ---------- folders ---------- */
const FOLDERS = {
  'Hardware/Network/Firewalls': 'firewall', 'Hardware/Network/Switches': 'switch', 'Hardware/Network/WiFi': 'wifi-ap',
  'Hardware/Servers': 'server', 'Hardware/Printers': 'printer',
  'Services/SaaS': 'service', 'Services/Internal': 'service',
  'Business processes': 'business-process',
  'Reference/Vendors': 'vendor', 'Reference/People': 'person', 'Reference/Licenses': 'license', 'Reference/Locations': 'location',
};
for (const [f, t] of Object.entries(FOLDERS)) put(`objects/${f}/_folder.yaml`, `# Folder settings\ndefault_template: ${t}\n`);

/* ---------- objects ---------- */
const objs = [];
const R = (type, target) => ({ type, target });
const add = (folder, id, name, template, tags, fields, relations = [], notes = '') =>
  objs.push({ folder, id, name, template, tags, fields, relations, notes, created: '2026-10-01T10:00:00', updated: '2026-10-01T10:00:00' });

// Locations
add('Reference/Locations', 'loc-0001', 'Head office', 'location', ['hq'], { Address: '1 Example Street\nSpringfield', 'Floor / room': '3rd floor' });
add('Reference/Locations', 'loc-0002', 'Branch office', 'location', ['branch'], { Address: '5 Sample Avenue\nShelbyville' });
add('Reference/Locations', 'loc-0003', 'Server room HQ', 'location', ['hq'], { 'Floor / room': '3rd floor, room 310' }, [R('located_in', 'loc-0001')]);
// People
add('Reference/People', 'per-0001', 'Alex Morgan', 'person', ['vendor-contact'], { Role: 'Network engineer', Email: 'alex@acmenet.example', Phone: '+1 555 0101' });
add('Reference/People', 'per-0002', 'Sam Taylor', 'person', ['vendor-contact'], { Role: 'Account manager', Email: 'sam@initech.example', Phone: '+1 555 0102' });
add('Reference/People', 'per-0003', 'Jordan Lee', 'person', ['internal'], { Role: 'IT administrator', Email: 'jordan.lee@example.com' });
add('Reference/People', 'per-0004', 'Robin Fox', 'person', ['internal'], { Role: 'Head of sales', Email: 'robin.fox@example.com' });
add('Reference/People', 'per-0005', 'Casey Kim', 'person', ['vendor-contact'], { Role: 'Support lead', Email: 'support@globex.example', Phone: '+1 555 0105' });
// Vendors
add('Reference/Vendors', 'ven-0001', 'Microsoft', 'vendor', ['cloud'], { Website: 'https://admin.microsoft.com', 'Support phone': 'via admin portal' });
add('Reference/Vendors', 'ven-0002', 'Acme Networks Ltd', 'vendor', ['network'], { Website: 'https://acmenet.example', 'Support phone': '+1 555 0110', 'Support email': 'support@acmenet.example', 'Contract number': 'AN-2024-17', 'Contract until': '2027-03-31' }, [R('contact', 'per-0001')]);
add('Reference/Vendors', 'ven-0003', 'Initech Software Ltd', 'vendor', [], { Website: 'https://initech.example', 'Support email': 'help@initech.example', 'Contract number': 'IT-0042', 'Contract until': '2026-12-31' }, [R('contact', 'per-0002')], 'Contract renewal negotiations start in **November**.');
add('Reference/Vendors', 'ven-0004', 'Globex CRM Inc', 'vendor', ['cloud'], { Website: 'https://globex.example', 'Support email': 'support@globex.example' }, [R('contact', 'per-0005')]);
add('Reference/Vendors', 'ven-0005', 'Umbrella Backup Ltd', 'vendor', [], { 'Support phone': '+1 555 0150' });
// Licenses
add('Reference/Licenses', 'lic-0001', 'Microsoft 365 E3', 'license', ['cloud'], { Product: 'Microsoft 365 E3', Quantity: '45', 'Renewal date': '2027-01-31', 'Cost / year': '$21,600' }, [R('supported_by', 'ven-0001')]);
add('Reference/Licenses', 'lic-0002', 'OrderDesk ERP', 'license', [], { Product: 'OrderDesk ERP, 30 users', Quantity: '30', 'Renewal date': '2026-12-31', 'Contract number': 'IT-0042' }, [R('supported_by', 'ven-0003')]);
// Network
add('Hardware/Network/Firewalls', 'fw-0001', 'HQ-FW1', 'firewall', ['hq', 'network', 'critical'], { Hostname: 'hq-fw1', 'IP Address': '10.10.0.1', 'Serial/MAC': 'FW-TEST-0001', Model: 'Palo Alto PA-440', Firmware: '11.1.2', Status: 'Active', 'Purchase date': '2024-02-12', 'Warranty until': '2027-02-12' }, [R('located_in', 'loc-0003'), R('supported_by', 'ven-0002')]);
add('Hardware/Network/Firewalls', 'fw-0002', 'BR-FW1', 'firewall', ['branch', 'network'], { Hostname: 'br-fw1', 'IP Address': '10.20.0.1', 'Serial/MAC': 'FW-TEST-0002', Model: 'Palo Alto PA-410', Status: 'Active' }, [R('located_in', 'loc-0002'), R('supported_by', 'ven-0002')]);
add('Hardware/Network/Switches', 'sw-0001', 'HQ-SW-CORE', 'switch', ['hq', 'network', 'critical'], { Hostname: 'hq-sw-core', 'IP Address': '10.10.0.2', 'Serial/MAC': 'SW-TEST-0001', Model: 'Aruba 6300M 48G', Ports: '48', Status: 'Active' }, [R('connected_to', 'fw-0001'), R('located_in', 'loc-0003'), R('supported_by', 'ven-0002')]);
add('Hardware/Network/Switches', 'sw-0002', 'HQ-SW1', 'switch', ['hq', 'network'], { Hostname: 'hq-sw1', 'IP Address': '10.10.0.3', 'Serial/MAC': 'SW-TEST-0002', Model: 'Aruba 6100 24G', Ports: '24', Status: 'Active' }, [R('connected_to', 'sw-0001'), R('located_in', 'loc-0001')]);
add('Hardware/Network/Switches', 'sw-0003', 'HQ-SW2', 'switch', ['hq', 'network'], { Hostname: 'hq-sw2', 'IP Address': '10.10.0.4', 'Serial/MAC': 'SW-TEST-0003', Model: 'Aruba 6100 24G', Ports: '24', Status: 'Active' }, [R('connected_to', 'sw-0001'), R('located_in', 'loc-0001')]);
add('Hardware/Network/Switches', 'sw-0004', 'BR-SW1', 'switch', ['branch', 'network'], { Hostname: 'br-sw1', 'IP Address': '10.20.0.2', 'Serial/MAC': 'SW-TEST-0004', Model: 'Aruba 6100 12G', Ports: '12', Status: 'Active' }, [R('connected_to', 'fw-0002'), R('located_in', 'loc-0002')]);
const ap = (id, name, tag, ip, sn, sw, loc, notes = '') => add('Hardware/Network/WiFi', id, name, 'wifi-ap', [tag, 'network', 'wifi'],
  { Hostname: name.toLowerCase(), 'IP Address': ip, 'Serial/MAC': sn, Model: 'Aruba AP-515', SSIDs: 'CORP, GUEST', Status: 'Active' }, [R('connected_to', sw), R('located_in', loc)], notes);
ap('ap-0001', 'HQ-AP1', 'hq', '10.10.20.11', 'e4:38:83:00:00:01', 'sw-0002', 'loc-0001', 'Ceiling mount, meeting room **Orion**.');
ap('ap-0002', 'HQ-AP2', 'hq', '10.10.20.12', 'e4:38:83:00:00:02', 'sw-0002', 'loc-0001');
ap('ap-0003', 'HQ-AP3', 'hq', '10.10.20.13', 'e4:38:83:00:00:03', 'sw-0003', 'loc-0001');
ap('ap-0004', 'HQ-AP4', 'hq', '10.10.20.13', 'e4:38:83:00:00:04', 'sw-0003', 'loc-0001', 'TEST: this AP intentionally has the same IP as HQ-AP3, to show the duplicate warning.');
ap('ap-0005', 'BR-AP1', 'branch', '10.20.20.11', 'e4:38:83:00:00:05', 'sw-0004', 'loc-0002');
add('Hardware/Printers', 'prn-0001', 'HQ-PRN1', 'printer', ['hq'], { Hostname: 'hq-prn1', 'IP Address': '10.10.30.10', 'Serial/MAC': 'PRN-TEST-0001', Model: 'HP LaserJet M507', Status: 'Active' }, [R('connected_to', 'sw-0002'), R('located_in', 'loc-0001')]);
// Servers
add('Hardware/Servers', 'srv-0001', 'HQ-HV01', 'server', ['hq', 'critical'], { Hostname: 'hq-hv01', 'IP Address': '10.10.10.11', 'Serial/MAC': 'SRV-TEST-0001', Kind: 'Physical', OS: 'Windows Server 2022 Hyper-V', 'CPU / RAM': '2×16 cores / 256 GB', Status: 'Active', Criticality: 'Critical' }, [R('connected_to', 'sw-0001'), R('located_in', 'loc-0003')]);
add('Hardware/Servers', 'srv-0002', 'HQ-HV02', 'server', ['hq', 'critical'], { Hostname: 'hq-hv02', 'IP Address': '10.10.10.12', 'Serial/MAC': 'SRV-TEST-0002', Kind: 'Physical', OS: 'Windows Server 2022 Hyper-V', 'CPU / RAM': '2×16 cores / 256 GB', Status: 'Active', Criticality: 'Critical' }, [R('connected_to', 'sw-0001'), R('located_in', 'loc-0003')]);
add('Hardware/Servers', 'srv-0003', 'HQ-DC01', 'server', ['hq', 'critical'], { Hostname: 'hq-dc01', 'IP Address': '10.10.10.21', Kind: 'Virtual', OS: 'Windows Server 2022', 'CPU / RAM': '4 vCPU / 8 GB', Status: 'Active', Criticality: 'Critical' }, [R('runs_on', 'srv-0001')]);
add('Hardware/Servers', 'srv-0004', 'HQ-FS01', 'server', ['hq'], { Hostname: 'hq-fs01', 'IP Address': '10.10.10.22', Kind: 'Virtual', OS: 'Windows Server 2022', 'CPU / RAM': '4 vCPU / 16 GB', Status: 'Active', Criticality: 'High' }, [R('runs_on', 'srv-0002')]);
add('Hardware/Servers', 'srv-0005', 'HQ-APP01', 'server', ['hq'], { Hostname: 'hq-app01', 'IP Address': '10.10.10.23', Kind: 'Virtual', OS: 'Windows Server 2019', 'CPU / RAM': '8 vCPU / 32 GB', Status: 'Active', Criticality: 'High' }, [R('runs_on', 'srv-0001')]);
add('Hardware/Servers', 'srv-0006', 'HQ-BKP01', 'server', ['hq'], { Hostname: 'hq-bkp01', 'IP Address': '10.10.10.30', 'Serial/MAC': 'SRV-TEST-0006', Kind: 'Physical', OS: 'Windows Server 2022', Status: 'Active', Criticality: 'High' }, [R('connected_to', 'sw-0001'), R('located_in', 'loc-0003')]);
// Services
add('Services/SaaS', 'svc-0001', 'Microsoft 365', 'service', ['cloud', 'critical'], { Hosting: 'Cloud (SaaS)', URL: 'https://admin.microsoft.com', Criticality: 'Critical', SLA: 'true', 'SLA details': '99.9% financially backed SLA\nSupport via admin portal', Status: 'Active' }, [R('supported_by', 'ven-0001'), R('licensed_by', 'lic-0001'), R('business_owner', 'per-0003')]);
add('Services/SaaS', 'svc-0005', 'Globex CRM', 'service', ['cloud'], { Hosting: 'Cloud (SaaS)', URL: 'https://app.globex.example', Criticality: 'High', SLA: 'true', 'SLA details': 'Response within 4 h on business days', Status: 'Active' }, [R('supported_by', 'ven-0004'), R('business_owner', 'per-0004'), R('depends_on', 'svc-0001')]);
add('Services/Internal', 'svc-0002', 'Active Directory', 'service', ['critical'], { Hosting: 'On-premises', Criticality: 'Critical', Status: 'Active' }, [R('runs_on', 'srv-0003'), R('business_owner', 'per-0003')]);
add('Services/Internal', 'svc-0003', 'File shares', 'service', [], { Hosting: 'On-premises', Criticality: 'High', Status: 'Active' }, [R('runs_on', 'srv-0004'), R('depends_on', 'svc-0002'), R('business_owner', 'per-0003')], 'Shares: `\\\\hq-fs01\\IT`, `\\\\hq-fs01\\Common`.');
add('Services/Internal', 'svc-0004', 'OrderDesk ERP', 'service', ['critical'], { Hosting: 'On-premises', URL: 'https://orderdesk.example.com', Criticality: 'Critical', SLA: 'true', 'SLA details': 'Vendor support 8/5, critical incidents 24/7 by phone', Status: 'Active' }, [R('runs_on', 'srv-0005'), R('depends_on', 'svc-0002'), R('supported_by', 'ven-0003'), R('business_owner', 'per-0004'), R('licensed_by', 'lic-0002')]);
add('Services/Internal', 'svc-0006', 'Backup', 'service', [], { Hosting: 'On-premises', Criticality: 'High', SLA: 'false', Status: 'Active' }, [R('runs_on', 'srv-0006'), R('supported_by', 'ven-0005'), R('business_owner', 'per-0003')], 'Nightly backups of all VMs, 30-day retention.');
// Business processes
add('Business processes', 'bp-0001', 'Order to cash', 'business-process', ['critical'], { Description: 'From customer order to paid invoice.', Criticality: 'Critical', RTO: '4 h', RPO: '1 h' }, [R('uses', 'svc-0004'), R('uses', 'svc-0005'), R('uses', 'svc-0001'), R('business_owner', 'per-0004')]);
add('Business processes', 'bp-0002', 'Customer onboarding', 'business-process', [], { Description: 'Contract signing, CRM entry, first order.', Criticality: 'High', RTO: '8 h', RPO: '4 h' }, [R('uses', 'svc-0005'), R('uses', 'svc-0001'), R('business_owner', 'per-0004')]);
add('Business processes', 'bp-0003', 'Document archive', 'business-process', [], { Description: 'Storing signed documents for 10 years.', Criticality: 'Medium', RTO: '24 h', RPO: '24 h' }, [R('uses', 'svc-0003'), R('uses', 'svc-0006'), R('business_owner', 'per-0003')]);

for (const o of objs) if (/^(fw|sw|srv|ap|prn)-/.test(o.id) || ['svc-0001', 'svc-0002', 'svc-0003', 'svc-0006'].includes(o.id)) o.relations.push(R('technical_owner', 'per-0003'));
objs.find(o => o.id === 'svc-0004').relations.push(R('technical_owner', 'per-0002'));
for (const o of objs) put(`objects/${o.folder}/${o.id} ${o.name}.md`, serialize(o, templates));

// sample history for HQ-AP1 (two older versions)
const ap1 = objs.find(o => o.id === 'ap-0001');
const v1 = JSON.parse(JSON.stringify(ap1)); v1.fields['IP Address'] = '10.10.20.50'; delete v1.fields.SSIDs; v1.notes = ''; v1.updated = '2026-10-01T10:00:00';
const v2 = JSON.parse(JSON.stringify(ap1)); v2.fields['IP Address'] = '10.10.20.11'; v2.fields.SSIDs = 'CORP'; v2.notes = 'Ceiling mount.'; v2.updated = '2026-10-14T09:12:40';
ap1.updated = '2026-10-27T15:31:02';
put(`objects/${ap1.folder}/${ap1.id} ${ap1.name}.md`, serialize(ap1, templates));
put('_history/ap-0001/2026-10-14T09-12-40.md', serialize(v1, templates));
put('_history/ap-0001/2026-10-27T15-31-02.md', serialize(v2, templates));

put('README.md', fs.readFileSync(path.join(__dirname, 'src/README-data.md'), 'utf8'));

fs.rmSync(OUT, { recursive: true, force: true });
for (const [p, t] of Object.entries(files)) { const fp = path.join(OUT, p); fs.mkdirSync(path.dirname(fp), { recursive: true }); fs.writeFileSync(fp, t); }
fs.mkdirSync(path.join(__dirname, 'dist'), { recursive: true });
fs.writeFileSync(path.join(__dirname, 'dist/demo-files.json'), JSON.stringify(files));
console.log('files:', Object.keys(files).length, 'objects:', objs.length);
