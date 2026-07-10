# Platform ops SLAs (Attention)

These are internal response targets for InsightHire platform admins triaging the **Attention** queue. Quiet / abandoned journeys are **engagement**, not SLA breaches.

| Signal | Target | Notes |
|--------|--------|--------|
| Failed journey response (`FAILED`) | Acknowledge / retry or escalate **&lt; 4 hours** during business hours | Prefer forensics → retry; dismiss only with reason if not actionable |
| Video / response `PENDING` too long | Clear or escalate when **&gt; 1 hour** with video present | Shown as queue delay / info severity |
| Response stuck in `PROCESSING` | Investigate when **&gt; 30 minutes** | Counts toward critical session alerts |
| Scoring gate (session at score-gate with failures) | Same as failed responses | Filter: Scoring gate on Attention |
| Location anomalies | Review within **1 business day** | Anomalies surface; not always fraud |

## What is out of SLA

- Quiet 24h+ / abandoned sessions (Engagement tab) — tenant engagement, not platform failure.
- E2E harness orgs — excluded from monitoring rollups.

## Trackability

Triage actions (`dismiss_stuck_candidate`, `clear_stuck_dismissal`, `retry_stuck_candidate`, `bulk_retry_stuck_candidates`) are written to `admin_audit_logs`. Filter them on **Audit → Attention triage**.
