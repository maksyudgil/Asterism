---
id: svc-0004
name: OrderDesk ERP
template: service
tags: [critical]
created: 2026-10-01T10:00:00
updated: 2026-10-01T10:00:00
fields:
  Hosting: On-premises
  URL: https://orderdesk.example.com
  Criticality: Critical
  SLA: true
  SLA details: Vendor support 8/5, critical incidents 24/7 by phone
  Status: Active
relations:
  - {type: runs_on, target: srv-0005}
  - {type: depends_on, target: svc-0002}
  - {type: supported_by, target: ven-0003}
  - {type: business_owner, target: per-0004}
  - {type: licensed_by, target: lic-0002}
  - {type: technical_owner, target: per-0002}
---
