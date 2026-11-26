# 0007 — Individual payments, proof linkage and settings isolation

Date: 2026-11-26
Status: Accepted

## Context

The cumulative paid field cannot distinguish a GCash deposit from a cash balance. Refunds previously left the displayed receivable closed. Website and QR settings shared a replacement save, risking unrelated overwrites. Online arrival payments need staff-uploaded evidence viewable on bookings.

## Decision

Extend the existing append-only ledger with methods, retain gross paid, and backfill/cache refunds on bookings. Record each received amount under a booking lock with idempotency and explicit proof linkage for electronic methods. Keep guest-selected option identity in receipt metadata; a choice/screenshot is not verified funds. Share the private receipt bucket and signed upload/byte verification boundary for staff, registering upload prefixes before URL issuance for deletion cleanup. Add a separate idempotent Finished status requiring arrival and no net balance, retaining original allocation intervals and arrival reporting.

Keep public settings in their existing row and historical snapshots unchanged. Split admin forms/endpoints and merge disjoint fields under a row lock. Preserve legacy method/date uncertainty rather than infer payment channels. No new provider, gateway, bucket or dependency.

## Alternatives and consequences

A cumulative textbox or boolean Fully paid toggle would lose transaction evidence and allow arbitrary totals. Replacing gross paid with net would rewrite historical semantics. Separate settings rows would require snapshot and public-loader migration without improving the scoped merge. Refunds can reopen a completed booking's financial balance while preserving operational completion; replacement payment is allowed in that specific finished state. Finished stays retain allocated intervals even after early checkout.

Migration 005 disables legacy positive financial review; coordinate migration and app deployment during a short hold/staff-review pause. A simple app rollback cannot restore that contract. Use forward fixes and preserve financial history.

## Verification and follow-up

PGlite tests cover method/proof/ownership/retry/refund/completion/settings/cleanup behavior; browser fixtures cover selected QR, separate editors and failed-save recovery. These do not establish real Supabase upload transport or independent-connection lock scheduling. See [Testing](../TESTING.md) for current evidence and release limits.
