# Database and business rules

Authoritative schema: [001_booking.sql](../supabase/migrations/001_booking.sql). It targets a fresh Supabase project. Do not rerun it against an existing live schema: it creates tables/functions and broadly revokes default public-schema writes/function execution before granting application access.

## Records and relationships

All application tables are in `public` and have RLS enabled. UUID IDs default to generated values unless otherwise noted. Money is integer PHP centavos; database timestamps are timezone-aware and scheduling is interpreted in Asia/Manila.

| Table | Important fields and relationships | Constraints / access |
| --- | --- | --- |
| `admins` | `user_id` primary key → `auth.users`, cascades on user deletion | Explicit staff allowlist; users can select their own membership, not promote themselves |
| `resources` | `id`, `name`, `capacity` | Capacity 1–10000; shared pool used by offerings and allocations; admin reads |
| `offerings` | Unique URL `slug`, name, kind, description, images/amenities, publication flag, resource FK, allocation basis, guest maximum, price/basis/deposit, schedule/times/slots, update time | Published rows require a rate; public reads see published rows, admins also see drafts |
| `site_content` | Text primary key `key`, JSONB `value`; current key `settings` | Public read; editable through trusted admin function; never contains secrets |
| `bookings` | UUID, unique human reference, nullable user FK, guest contact, offering/resource FKs, copied offering name, period, guests/units/allocation, total/deposit/paid, status/expiry, unique request UUID, snapshot, guest-visible admin note, timestamps | Positive period/counts/totals; deposit ≤ total; guest-owned reads and all-admin reads |
| `receipts` | UUID, booking FK, unique storage path, transaction reference, creation time | Metadata only; owner/admin reads through booking relationship; finalization is server-only |
| `blackouts` | UUID, resource FK, start/end, reason | Positive interval; admin reads; creation rejects overlaps with active reservations |
| `audit_events` | Identity bigint ID, actor UUID, action, record ID text, JSON detail, creation time | Admin-only reads; internal refund records are in detail, not guest booking columns |
| `email_jobs` | UUID, optional booking FK, recipient/subject/body, attempts/status, available/locked times, last error, creation time | Admin-only reads; scheduler service role processes rows |

One resource can serve multiple offerings. One offering has many bookings; one booking has many receipt attempts, audit entries, and email jobs. Most references use default FK deletion restrictions; there is no general hard-delete or guest-account erasure workflow. Do not delete inventory or users with bookings casually. Manual staff bookings have null user ownership and remain staff-managed.

TypeScript types are deliberately lightweight. SQL allows null draft prices and manual booking user IDs; some UI fields still use stricter types. Database-only fields such as request IDs, snapshots, and audit details can appear in server responses even if omitted from UI types. `refund_note` in the UI is an input convenience, not a persisted booking column.

## Booking state machine

| From | Trigger | To | Capacity and effects |
| --- | --- | --- | --- |
| New | Guest hold | `awaiting_payment` | Allocates for 30 minutes; no payment verified |
| New | Staff manual booking | `confirmed` | Allocates immediately; paid starts at zero; confirmation queued |
| `awaiting_payment` | Proof finalized before expiry | `pending_review` | Retains allocation; acknowledgment queued |
| `correction_requested` | Corrected proof finalized | `pending_review` | Retains allocation; acknowledgment queued |
| `pending_review` or `correction_requested` | Staff confirms sufficient verified payment | `confirmed` | Retains allocation; confirmation queued |
| `pending_review` or `correction_requested` | Staff requests correction | `correction_requested` | Retains allocation without automatic timeout; guest update queued |
| `pending_review` or `correction_requested` | Staff declines | `declined` | Releases allocation; decline queued |
| `awaiting_payment`, `pending_review`, `correction_requested`, or `confirmed` | Staff cancels | `cancelled` | Releases allocation; cancellation queued; refund remains manual |
| `awaiting_payment` past expiry | Scheduled cleanup | `expired` | Already excluded by availability; guest UI also derives expiry before cleanup |
| `confirmed` | Staff records cumulative paid amount | `confirmed` | Allocation unchanged; audited, no balance-only email |

Repeated decisions that already match status return the row without another state email; repeated receipt IDs return the existing booking. New requests should use a new request UUID. Reuse an existing UUID only for an identical retry; the hold function returns the prior row rather than comparing every original input field.

## Availability and pricing

- Allocation uses half-open overlap: existing start < requested end AND existing end > requested start. Adjacent periods can coexist; configured overnight times still determine actual overlap.
- Pending review, correction requested, and confirmed rows consume capacity. Unexpired awaiting-payment rows also consume it. Declined/cancelled/expired rows do not. No automatic timeout exists for uploaded proof awaiting review.
- `allocation_basis=unit` consumes requested units/pitches; guest basis consumes party size. Guest count must not exceed offering max-guests × units. Shared-guest offerings should configure a suitable per-booking guest maximum.
- Quote permits arrival within the next 730 days and 1–60 overnight nights; the arrival timestamp must be in the future. Venue slots use the selected local date; end ≤ start rolls into the following day.
- Cost = price × (guests for guest pricing, otherwise units) × (1 for per-booking unit pricing, otherwise nights). Slot nights are 1. Deposit rounds upward from total × percentage / 100. Total is capped at 1,000,000,000 centavos.
- Bookings retain copied price, deposit, name, schedule, and payment instructions. Editing an offering/settings does not reprice existing bookings.
- Hold creation locks the offering row, then its resource row, before rechecking availability. Admin offering edits use the same lock ordering; upcoming active reservations prevent pool reassignment/capacity changes. Blackouts lock the resource before checking overlaps.

## Trusted functions

| Function | Caller | Responsibility |
| --- | --- | --- |
| `is_admin()` | Public/authenticated | Resolve current identity's allowlist membership |
| `booking_quote(...)` | Public/authenticated | Validate schedule/counts and calculate price/availability without allocation |
| `create_hold(...)` | Authenticated | Derive guest identity, serialize allocation, snapshot, audit; admin-only manual mode |
| `submit_receipt(...,p_user)` | Service role only | Finalize an owned receipt after server byte verification; update state and enqueue acknowledgment atomically |
| `review_booking(...)` | Authenticated, admin checked internally | Enforce transitions and payment amounts, audit, enqueue applicable email |
| `save_offering(jsonb)` | Authenticated admin | Create/update offering/resource configuration and audit |
| `save_content(jsonb)` | Authenticated admin | Replace public settings and audit |
| `add_blackout(...)`, `remove_blackout(uuid)` | Authenticated admin | Maintain inventory closures and audit |
| `claim_email_jobs()` | Service role only | Expire unpaid holds and atomically claim due/retryable jobs |

These security-definer functions set a fixed search path. Most mutations derive identity from `auth.uid()`; receipt finalization instead accepts a server-validated user ID and is not executable by guests. Direct ordinary-user table writes are revoked. Admin operations still check admin membership inside SQL, not just in HTTP handlers. Service credentials bypass RLS and must stay server-only.

## Storage

`receipts` is private; `marketing` is public. Both enforce a 10 MB limit and JPEG/PNG/WebP MIME allowlist. No ordinary-client direct storage writes are granted. The server issues scoped upload URLs and checks original bytes before finalizing. Receipt paths are user/booking/file; marketing paths are user/file. Receipt download URLs last 60 seconds. Bucket metadata and transport must be validated against real staging, separately from fixture tests.

## Evolving the schema

Add numbered forward migrations for any database already initialized; do not edit 001 to change deployed data. Stage the migration with realistic data and roles, preserve booked snapshots, and test old/new application compatibility before rollout. Prefer expand/backfill/contract changes to immediate destructive edits. Document data effects and recovery in the same PR; an application rollback does not reverse a schema migration.

Backups/restoration and retention periods depend on the owner's configured provider plan and business policy. They are not yet verified. See [operations](OPERATIONS.md) and [release readiness](RELEASE.md).
