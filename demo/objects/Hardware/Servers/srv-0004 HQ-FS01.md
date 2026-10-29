---
id: srv-0004
name: HQ-FS01
template: server
tags: [hq]
created: 2026-10-01T10:00:00
updated: 2026-10-01T10:00:00
fields:
  Hostname: hq-fs01
  IP Address: 10.10.10.22
  Kind: Virtual
  OS: Windows Server 2022
  CPU / RAM: 4 vCPU / 16 GB
  Status: Active
  Criticality: High
relations:
  - {type: runs_on, target: srv-0002}
  - {type: technical_owner, target: per-0003}
---
