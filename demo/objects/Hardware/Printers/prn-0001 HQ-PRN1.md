---
id: prn-0001
name: HQ-PRN1
template: printer
tags: [hq]
created: 2026-10-01T10:00:00
updated: 2026-10-01T10:00:00
fields:
  Hostname: hq-prn1
  IP Address: 10.10.30.10
  Serial/MAC: PRN-TEST-0001
  Model: HP LaserJet M507
  Status: Active
relations:
  - {type: connected_to, target: sw-0002}
  - {type: located_in, target: loc-0001}
  - {type: technical_owner, target: per-0003}
---
