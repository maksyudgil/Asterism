---
id: sw-0004
name: BR-SW1
template: switch
tags: [branch, network]
created: 2026-10-01T10:00:00
updated: 2026-10-01T10:00:00
fields:
  Hostname: br-sw1
  IP Address: 10.20.0.2
  Serial/MAC: SW-TEST-0004
  Model: Aruba 6100 12G
  Ports: 12
  Status: Active
relations:
  - {type: connected_to, target: fw-0002}
  - {type: located_in, target: loc-0002}
  - {type: technical_owner, target: per-0003}
---
