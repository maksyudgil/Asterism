---
id: srv-0006
name: HQ-BKP01
template: server
tags: [hq]
created: 2026-10-01T10:00:00
updated: 2026-10-01T10:00:00
fields:
  Hostname: hq-bkp01
  IP Address: 10.10.10.30
  Serial/MAC: SRV-TEST-0006
  Kind: Physical
  OS: Windows Server 2022
  Status: Active
  Criticality: High
relations:
  - {type: connected_to, target: sw-0001}
  - {type: located_in, target: loc-0003}
  - {type: technical_owner, target: per-0003}
---
