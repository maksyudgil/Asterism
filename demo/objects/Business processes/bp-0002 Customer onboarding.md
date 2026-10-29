---
id: bp-0002
name: Customer onboarding
template: business-process
tags: []
created: 2026-10-01T10:00:00
updated: 2026-10-01T10:00:00
fields:
  Description: Contract signing, CRM entry, first order.
  Criticality: High
  RTO: 8 h
  RPO: 4 h
relations:
  - {type: uses, target: svc-0005}
  - {type: uses, target: svc-0001}
  - {type: business_owner, target: per-0004}
---
