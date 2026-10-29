---
id: sw-0003
name: HQ-SW2
template: switch
tags: [hq, network]
created: 2026-10-01T10:00:00
updated: 2026-10-01T10:00:00
fields:
  Hostname: hq-sw2
  IP Address: 10.10.0.4
  Serial/MAC: SW-TEST-0003
  Model: Aruba 6100 24G
  Ports: 24
  Status: Active
relations:
  - {type: connected_to, target: sw-0001}
  - {type: located_in, target: loc-0001}
  - {type: technical_owner, target: per-0003}
---
