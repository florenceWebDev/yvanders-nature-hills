# 0008 — Guest arrival times, booking continuation and staff alerts

Date: 2026-11-26
Status: Accepted; deployed through PR #13 on 26 November 2026

## Context

Guests lose their accommodation selection during authentication. Staff need new reservations across arrival dates and payment alerts. Personal booking history inadvertently includes every booking for admins because its query relies only on staff-capable RLS. The owner selected 24-hour days for every offering, multiple days, newest-first review and alerts to all current verified admins.

## Decision

Migration 006 replaces quote/hold signatures with a required effective arrival-time input, interpreted in Asia/Manila. Every new reservation lasts 1–60 whole days; per-booking prices stay flat and other price bases multiply by days. Existing booked timestamps/snapshots remain unchanged. Legacy schedule configuration remains stored but no longer controls new quotes. The UI explains that late arrival does not extend departure; payment-hold expiry and manual completion remain separate.

Personal history filters authenticated ownership in the trusted API. Keep staff database read privileges and protected staff routes for intentional administration. Manual reservations retain null ownership.

Use one browser-local versioned draft with 24-hour expiry and an opaque identifier in a validated local booking return URL. Requote after authentication and require confirmation; never trust saved price or inventory. Local storage contains contact details for this short continuation window and is cleared on successful hold/logout; it is not a cross-device draft service.

Create explicit admin outbox jobs transactionally after final booking pricing/status, guest proof audit and payment audit. Deduplicate event/recipient pairs; recipients are current verified admins at event time. Remove blanket BCC. Reuse existing leases, retries and provider idempotency. Guest and staff links route to their respective account/workspace.

Keep Supabase Auth and prepare branded confirmation/recovery templates. Owned-domain verification, SMTP activation and real inbox acceptance remain separate operational dependencies.

## Alternatives and consequences

An unreviewed inbox would require shared read/acknowledgment state; the owner chose simple newest-first history. A server draft service would enable cross-device recovery but adds private-data persistence and cleanup; this release handles the same browser only. Fixed venue slots were explicitly declined. Changing time policy needs a coordinated migration/application release; stale callers without arrival time fail safely rather than creating a different stay.

## Verification and follow-up

PGlite tests cover migration preservation, pricing, overlap boundaries and transactional event fan-out/retries. Actual handler tests use isolated adapters for ownership, authentication returns and worker failures. Production migration, preservation, staff/personal visibility, selected-time quotes, callbacks and resumed worker evidence are in [Testing](../TESTING.md). Rehearse migration/rollback and independent contention on isolated services before production. No live booking or payment is a test fixture.
