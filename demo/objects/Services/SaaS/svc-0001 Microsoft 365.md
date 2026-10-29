---
id: svc-0001
name: Microsoft 365
template: service
tags: [cloud, critical]
created: 2026-10-01T10:00:00
updated: 2026-10-01T10:00:00
fields:
  Hosting: Cloud (SaaS)
  URL: https://admin.microsoft.com
  Criticality: Critical
  SLA: true
  SLA details: |-
    99.9% financially backed SLA
    Support via admin portal
  Status: Active
relations:
  - {type: supported_by, target: ven-0001}
  - {type: licensed_by, target: lic-0001}
  - {type: business_owner, target: per-0003}
  - {type: technical_owner, target: per-0003}
---
