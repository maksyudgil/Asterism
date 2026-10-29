---
id: svc-0002
name: Active Directory
template: service
tags: [critical]
created: 2026-10-01T10:00:00
updated: 2026-10-01T10:00:00
fields:
  Hosting: On-premises
  Criticality: Critical
  Status: Active
relations:
  - {type: runs_on, target: srv-0003}
  - {type: business_owner, target: per-0003}
  - {type: technical_owner, target: per-0003}
---
