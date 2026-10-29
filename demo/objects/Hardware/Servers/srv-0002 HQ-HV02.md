---
id: srv-0002
name: HQ-HV02
template: server
tags: [hq, critical]
created: 2026-10-01T10:00:00
updated: 2026-10-01T10:00:00
fields:
  Hostname: hq-hv02
  IP Address: 10.10.10.12
  Serial/MAC: SRV-TEST-0002
  Kind: Physical
  OS: Windows Server 2022 Hyper-V
  CPU / RAM: 2×16 cores / 256 GB
  Status: Active
  Criticality: Critical
relations:
  - {type: connected_to, target: sw-0001}
  - {type: located_in, target: loc-0003}
  - {type: technical_owner, target: per-0003}
---
