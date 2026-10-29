---
id: svc-0003
name: File shares
template: service
tags: []
created: 2026-10-01T10:00:00
updated: 2026-10-01T10:00:00
fields:
  Hosting: On-premises
  Criticality: High
  Status: Active
relations:
  - {type: runs_on, target: srv-0004}
  - {type: depends_on, target: svc-0002}
  - {type: business_owner, target: per-0003}
  - {type: technical_owner, target: per-0003}
---

Shares: `\\hq-fs01\IT`, `\\hq-fs01\Common`.
