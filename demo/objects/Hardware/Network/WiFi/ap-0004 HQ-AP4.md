---
id: ap-0004
name: HQ-AP4
template: wifi-ap
tags: [hq, network, wifi]
created: 2026-10-01T10:00:00
updated: 2026-10-01T10:00:00
fields:
  Hostname: hq-ap4
  IP Address: 10.10.20.13
  Serial/MAC: e4:38:83:00:00:04
  Model: Aruba AP-515
  SSIDs: CORP, GUEST
  Status: Active
relations:
  - {type: connected_to, target: sw-0003}
  - {type: located_in, target: loc-0001}
  - {type: technical_owner, target: per-0003}
---

TEST: this AP intentionally has the same IP as HQ-AP3, to show the duplicate warning.
