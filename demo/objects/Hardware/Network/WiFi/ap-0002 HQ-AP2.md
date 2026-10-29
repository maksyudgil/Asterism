---
id: ap-0002
name: HQ-AP2
template: wifi-ap
tags: [hq, network, wifi]
created: 2026-10-01T10:00:00
updated: 2026-10-01T10:00:00
fields:
  Hostname: hq-ap2
  IP Address: 10.10.20.12
  Serial/MAC: e4:38:83:00:00:02
  Model: Aruba AP-515
  SSIDs: CORP, GUEST
  Status: Active
relations:
  - {type: connected_to, target: sw-0002}
  - {type: located_in, target: loc-0001}
  - {type: technical_owner, target: per-0003}
---
