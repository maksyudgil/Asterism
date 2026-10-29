---
id: srv-0003
name: HQ-DC01
template: server
tags: [hq, critical]
created: 2026-10-01T10:00:00
updated: 2026-10-01T10:00:00
fields:
  Hostname: hq-dc01
  IP Address: 10.10.10.21
  Kind: Virtual
  OS: Windows Server 2022
  CPU / RAM: 4 vCPU / 8 GB
  Status: Active
  Criticality: Critical
relations:
  - {type: runs_on, target: srv-0001}
  - {type: technical_owner, target: per-0003}
---
