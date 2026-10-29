---
id: bp-0001
name: Order to cash
template: business-process
tags: [critical]
created: 2026-10-01T10:00:00
updated: 2026-10-01T10:00:00
fields:
  Description: From customer order to paid invoice.
  Criticality: Critical
  RTO: 4 h
  RPO: 1 h
relations:
  - {type: uses, target: svc-0004}
  - {type: uses, target: svc-0005}
  - {type: uses, target: svc-0001}
  - {type: business_owner, target: per-0004}
---
