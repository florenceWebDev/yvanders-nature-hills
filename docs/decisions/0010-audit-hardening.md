# 0010 — Audit hardening and shared abuse protection
Date: 2026-11-26
Status: Accepted for implementation; production rollout pending

## Context

The audit reproduced conservative false sold-out results for disjoint reservations. HTTP routes had no shared application throttles and direct authenticated booking RPCs allowed repeated inventory holds. Email jobs could remain sending after a final-attempt crash; reporting and the bundled staff/guest reads had scaling limits. The owner selected three unresolved unpaid reservations, ten creations per rolling hour and existing Supabase infrastructure rather than another service.

## Decision

Use peak concurrent allocation, retaining transactional resource locks. Add a private hold-creation history and serialize each guest before checking quotas. Keep retry IDs idempotent and staff manual bookings exempt; preserve existing over-limit records. Direct hold calls receive the same database enforcement.

Keep shared HTTP counters in Supabase with service-only entry points, HMAC-derived identity keys, fixed windows and bounded cleanup. Trust the reserved Netlify runtime SITE_ID plus its ingress IP header; ignore generic forwarded headers. Missing configuration/provider storage fails closed. Netlify documents NETLIFY as build metadata, so it is not a runtime trust flag. Provider-side Auth/direct read protections remain separate.

Revoke direct public quote execution and provide service-only actor-aware/batch wrappers. The HTTP boundary validates actor identity; database wrappers repeat admin checks. No service key enters a client bundle. Public data alone has 30-second caching; dynamic nonce HTML and uncached booking operations remain separate.

Guard worker updates with rotating lease tokens, recover expired exhausted attempts, persist provider cooldowns and pace the application conservatively at one send per second. Keep idempotency keys; do not equate provider acceptance with inbox delivery. Paginate history/activity/blackouts, group daily reports and restrict image optimization to trusted paths. Fonts retain their original licenses and typography.

## Alternatives and consequences

Redis would reduce database counter traffic but adds credentials/provider cost. Process-local counters fail across server instances. HTTP-only quotas leave direct RPC bypass. Adding these counters adds a small database operation to protected HTTP calls, and failed-closed behavior can temporarily deny operations during a database/configuration outage.

Peak computation orders allocation changes instead of summing all overlaps; simultaneous endpoints are grouped to preserve half-open semantics. This is a shared-capacity model, not assignment of named physical units. Nonce CSP keeps dynamic HTML and does not attempt static page caching; inline styles remain allowed for configured palettes. External owner-hosted images retain direct loading to avoid unrestricted server fetches.

## Verification and follow-up

See [Testing](../TESTING.md) for actual isolated database/handler/security/build results and their limits. Migration 007 preserves a prior hold-grant pause. [Operations](../OPERATIONS.md#release-migration-007-audit-hardening) contains release ordering, pause/resume and recovery. Independent PostgreSQL connection contention, production-scale plans, hosted ingress/CSP/provider acceptance and independent backup/restore remain release gates. Production was not changed by implementation.
