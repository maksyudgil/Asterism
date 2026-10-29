---
id: bp-0003
name: Document archive
template: business-process
tags: []
created: 2026-10-01T10:00:00
updated: 2026-10-01T10:00:00
fields:
  Description: Storing signed documents for 10 years.
  Criticality: Medium
  RTO: 24 h
  RPO: 24 h
relations:
  - {type: uses, target: svc-0003}
  - {type: uses, target: svc-0006}
  - {type: business_owner, target: per-0003}
---
