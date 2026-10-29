---
id: ap-0005
name: BR-AP1
template: wifi-ap
tags: [branch, network, wifi]
created: 2026-10-01T10:00:00
updated: 2026-10-01T10:00:00
fields:
  Hostname: br-ap1
  IP Address: 10.20.20.11
  Serial/MAC: e4:38:83:00:00:05
  Model: Aruba AP-515
  SSIDs: CORP, GUEST
  Status: Active
relations:
  - {type: connected_to, target: sw-0004}
  - {type: located_in, target: loc-0002}
  - {type: technical_owner, target: per-0003}
---
