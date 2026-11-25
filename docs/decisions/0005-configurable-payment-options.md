# 0005 — Configurable payment options and disposable fixture cleanup
Date: 2026-11-26
Status: Accepted

## Context
The owner requires up to three separately configurable payment QRs and explicitly selected permanent deletion of fictional system-check records after testing.

## Decision
Store an ordered array of complete options in public settings. Preserve booking snapshots and normalize old snapshots on read. Validate in HTTP and trusted SQL; mirror the first option for the old reader during rollout. Migration 003 updates settings without rewriting bookings. Keep manual proof review and existing authorization.

Remove only the exact fixture and dependencies through a guarded service-only script, separate from schema rollout. Restore recognized fixture copy, clear its nonpayable QR, disable readiness and preserve real drafts/accounts. Keep a private retry manifest; log counts only.

## Alternatives and consequences
Three unrelated image fields duplicate validation and complicate ordering/details. Rewriting snapshots changes instructions for guests who may already have paid. The owner selected deletion over archival. Storage and REST cannot share one transaction, so cleanup unpublishes first and supports scoped retries. App rollback cannot restore deleted test history.

## Verification and follow-up
Application/database tests and production build pass. Live cleanup verified three bookings/dependencies removed, ten drafts intact and readiness disabled. Live migration 003 is applied and its settings/access checks passed. Production deployment and authenticated live editor checks remain pending; see [Testing](../TESTING.md).
