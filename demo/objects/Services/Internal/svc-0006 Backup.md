---
id: svc-0006
name: Backup
template: service
tags: []
created: 2026-10-01T10:00:00
updated: 2026-10-01T10:00:00
fields:
  Hosting: On-premises
  Criticality: High
  SLA: false
  Status: Active
relations:
  - {type: runs_on, target: srv-0006}
  - {type: supported_by, target: ven-0005}
  - {type: business_owner, target: per-0003}
  - {type: technical_owner, target: per-0003}
---

Nightly backups of all VMs, 30-day retention.
