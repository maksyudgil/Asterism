---
id: srv-0005
name: HQ-APP01
template: server
tags: [hq]
created: 2026-10-01T10:00:00
updated: 2026-10-01T10:00:00
fields:
  Hostname: hq-app01
  IP Address: 10.10.10.23
  Kind: Virtual
  OS: Windows Server 2019
  CPU / RAM: 8 vCPU / 32 GB
  Status: Active
  Criticality: High
relations:
  - {type: runs_on, target: srv-0001}
  - {type: technical_owner, target: per-0003}
---
