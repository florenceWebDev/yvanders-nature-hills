# 0006 — Appearance settings and permanent booking deletion
Date: 2026-11-26
Status: Accepted

## Context

The owner requested editable website imagery, logo, full palette and contact email, a daily reservation table, and booking deletion. They explicitly chose permanent erasure including financial entries rather than retained history.

## Decision

Extend existing public settings with optional validated appearance fields and legacy defaults. Render semantic CSS variables server-side and keep appearance previews scoped until save. Reuse range-filtered reservations for a Philippines-time daily list.

Provide owner-only active unpaid deletion and admin-only cancelled deletion through trusted row-locked SQL functions. Erase booking dependencies, financial entries and booking-specific audit history in one transaction. Queue private receipt-folder cleanup transactionally; an independent storage worker retries deletion and catches late uploads for 130 minutes. [Supabase signed upload URLs](https://supabase.com/docs/reference/javascript/file-buckets-createsigneduploadurl) remain valid for two hours. Refuse deletion during an active email-send lease.

## Alternatives and consequences

Archiving and detached financial retention were offered and rejected by the owner. Historical financial reports therefore change after deletion. SQL alone cannot erase storage objects; a durable queue makes failures recoverable without pretending that external deletion is atomic. No application undo, email recall or backup rewriting is provided. Existing code can continue reading settings without appearance fields. A general retention/account-deletion policy remains separate.

## Verification and follow-up

Local SQL tests cover appearance validation, role/ownership/state guards, complete dependency erasure, changing reports, released capacity and email leases. Mocked storage tests cover retry and late uploads; they are not live-service evidence. Apply migration 004 and verify independent concurrent transactions and actual storage cleanup on isolated staging before production deployment.
