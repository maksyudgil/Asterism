---
id: sw-0001
name: HQ-SW-CORE
template: switch
tags: [hq, network, critical]
created: 2026-10-01T10:00:00
updated: 2026-10-01T10:00:00
fields:
  Hostname: hq-sw-core
  IP Address: 10.10.0.2
  Serial/MAC: SW-TEST-0001
  Model: Aruba 6300M 48G
  Ports: 48
  Status: Active
relations:
  - {type: connected_to, target: fw-0001}
  - {type: located_in, target: loc-0003}
  - {type: supported_by, target: ven-0002}
  - {type: technical_owner, target: per-0003}
---
