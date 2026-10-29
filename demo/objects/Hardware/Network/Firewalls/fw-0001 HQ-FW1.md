---
id: fw-0001
name: HQ-FW1
template: firewall
tags: [hq, network, critical]
created: 2026-10-01T10:00:00
updated: 2026-10-01T10:00:00
fields:
  Hostname: hq-fw1
  IP Address: 10.10.0.1
  Serial/MAC: FW-TEST-0001
  Model: Palo Alto PA-440
  Firmware: 11.1.2
  Status: Active
  Purchase date: 2024-02-12
  Warranty until: 2027-02-12
relations:
  - {type: located_in, target: loc-0003}
  - {type: supported_by, target: ven-0002}
  - {type: technical_owner, target: per-0003}
---
