---
id: svc-0005
name: Globex CRM
template: service
tags: [cloud]
created: 2026-10-01T10:00:00
updated: 2026-10-01T10:00:00
fields:
  Hosting: Cloud (SaaS)
  URL: https://app.globex.example
  Criticality: High
  SLA: true
  SLA details: Response within 4 h on business days
  Status: Active
relations:
  - {type: supported_by, target: ven-0004}
  - {type: business_owner, target: per-0004}
  - {type: depends_on, target: svc-0001}
---
