# Database and business rules

Authoritative schema: [001_booking.sql](../supabase/migrations/001_booking.sql), followed by [002_administration.sql](../supabase/migrations/002_administration.sql) and [003_payment_options.sql](../supabase/migrations/003_payment_options.sql). Apply 001–007 in order to a fresh project, including [004_appearance_deletion.sql](../supabase/migrations/004_appearance_deletion.sql); an existing 006 database needs [007_audit_hardening.sql](../supabase/migrations/007_audit_hardening.sql). Earlier databases must apply all intervening migrations. Migration 007 is prepared and not yet applied to production. Do not rerun it against an existing live schema: it creates tables/functions and broadly revokes default public-schema writes/function execution before granting application access.

## Records and relationships

All application tables are in `public` and have RLS enabled. UUID IDs default to generated values unless otherwise noted. Money is integer PHP centavos; database timestamps are timezone-aware and scheduling is interpreted in Asia/Manila.

| Table | Important fields and relationships | Constraints / access |
| --- | --- | --- |
| `admins` | `user_id` primary key → `auth.users`, cascades on user deletion | Explicit staff allowlist; users can select their own membership, not promote themselves |
| `resources` | `id`, `name`, `capacity` | Capacity 1–10000; shared pool used by offerings and allocations; admin reads |
| `offerings` | Unique URL `slug`, name, kind, description, images/amenities, publication flag, resource FK, allocation basis, guest maximum, price/basis/deposit, schedule/times/slots, update time | Published rows require a rate; public reads see published rows, admins also see drafts |
| `site_content` | Text primary key `key`, JSONB `value`; current key `settings` | Public read; editable through trusted admin function; never contains secrets |
| `bookings` | UUID, unique human reference, nullable user FK, guest contact, offering/resource FKs, copied offering name, period, guests/units/allocation, total/deposit/paid, status/expiry, unique request UUID, snapshot, guest-visible admin note, timestamps | Positive period/counts; nonnegative total/deposit, zero only for complimentary reservations; deposit ≤ total; guest-owned reads and all-admin reads |
| `receipts` | UUID, booking FK, unique storage path, transaction reference, creation time | Metadata only; owner/admin reads through booking relationship; finalization is server-only |
| `blackouts` | UUID, resource FK, start/end, reason | Positive interval; admin reads; creation rejects overlaps with active reservations |
| `audit_events` | Identity bigint ID, actor UUID, action, record ID text, JSON detail, creation time | Admin-only reads; internal refund records are in detail, not guest booking columns |
| `email_jobs` | UUID, optional booking FK, recipient/subject/body, attempts/status, available/locked times, last error, creation time | Admin-only reads; scheduler service role processes rows |

One resource can serve multiple offerings. One offering has many bookings; one booking has many receipt attempts, audit entries, and email jobs. Most references use default FK deletion restrictions; permanent booking deletion is available only through the guarded functions described below; there is no guest-account erasure workflow. Do not delete inventory or users with bookings casually. Manual staff bookings have null user ownership and remain staff-managed.

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
| `confirmed` | Staff records an individual payment | `confirmed` | Method, date, actor and optional cash note / required online proof are recorded atomically |
| `confirmed` | Staff finishes an arrived, fully paid stay | `finished` | Completion actor/time retained; original allocation interval and arrival value preserved |

Repeated decisions that already match status return the row without another state email; repeated receipt IDs return the existing booking. New requests should use a new request UUID. Reuse an existing UUID only for an identical retry; the hold function returns the prior row rather than comparing every original input field.

## Availability and pricing

- Allocation uses half-open overlap: existing start < requested end AND existing end > requested start. Adjacent periods can coexist; new booking intervals use the guest-selected arrival time on both dates.
- Pending review, correction requested, confirmed and finished rows consume capacity for their original intervals. Unexpired awaiting-payment rows also consume it. Declined/cancelled/expired rows do not. No automatic timeout exists for uploaded proof or complimentary reservations awaiting review.
- `allocation_basis=unit` consumes requested units/pitches; guest basis consumes party size. Guest count must not exceed offering max-guests × units. Shared-guest offerings should configure a suitable per-booking guest maximum.
- Quote permits arrival within the next 730 days and 1–60 booked days for every offering. p_arrival_time is required, with whole-minute precision from 00:00 through 23:59. Both endpoints use that time in Asia/Manila; arrival must be in the future. Existing slot/check-in/check-out configuration no longer controls new intervals.
- Cost = price × (guests for guest pricing, otherwise units) × (1 for per-booking unit pricing, otherwise nights). The nights field counts whole booked days, including venue/day-use bookings. Deposit rounds upward from total × percentage / 100. Total is capped at 1,000,000,000 centavos.
- Bookings retain copied price, deposit, name, schedule, and payment instructions. Editing an offering/settings does not reprice existing bookings.
- Hold creation takes a request advisory lock, locks the promo row when supplied, then the offering and resource rows, before rechecking availability. Admin offering edits use the same lock ordering; upcoming active reservations prevent pool reassignment/capacity changes. Blackouts lock the resource before checking overlaps.

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

## Administration migration and invariants

002 adds bookings.subtotal/discount/promo_code, promo definitions and redemptions, and append-only payment_entries. Existing totals become subtotals with zero discount. Existing paid amounts become undated opening entries: no historical payment date is invented. Existing snapshots remain intact. The application requires 002 before its new API contracts are served.

- promos: unique immutable code; percent basis points or fixed centavos; optional maximum saving, minimum subtotal, eligible offering UUIDs, inclusive local booking/stay dates and global/per-normalized-email limits. A fixed discount can exceed subtotal but the saving is clamped to subtotal. No stacking.
- promo_redemptions: one row per booking, promo and guest email, consumed flag. Active holds/reviews reserve usage. Expired unpaid, declined or cancelled unconsumed uses stop counting. Verified-paid or approved complimentary uses are permanently consumed. Promo-row locks serialize final-use competition and edits across different inventory pools. Quotes are informational.
- payment_entries: payment/refund/opening, positive amount, effective timestamp (null only for opening), reference, actor, unique request UUID and creation time. Direct client mutations are revoked. Migration 005 supersedes cumulative review payments with record_payment; refund recording uses the same booking lock and cannot exceed remaining net collections. Dates supplied by staff are stored at local noon for daily reporting. Notes are not converted into monetary refunds.
- Complimentary guests enter pending_review with total=deposit=0. No proof/correction is required; approve with paid=0 or decline with a reason. Capacity stays allocated until resolved. Manual staff reservations are already approved, including complimentary ones. Confirmation and cancellation use the existing outbox.
- manage_admin locks membership changes before checking identity. Its delete trigger protects the final administrator (including normal account deletion cascading to membership); removal preserves the user's account. list_admins returns only staff identities. No owner/staff distinction exists by user choice. Server and SQL boundaries recheck access.
- admin_report aggregates complete records by Asia/Manila boundaries: created cohorts for counts, current confirmed and finished arrivals for booking value/outstanding, and effective ledger dates for collections/refunds. Cancelled paid bookings retain collection history but leave confirmed booking value. After 005, outstanding is max(total-paid+refunded,0); refunds reopen the receivable without changing reservation status.

Private *_base functions preserve the original allocation/review logic and have no PUBLIC/anon/authenticated execute access. The new wrappers are the supported entrypoints. Only privileged operators may alter ledger history for exceptional repair; the application exposes append-only recording.

Upgrade in staging first, transactionally, after a database backup. Apply 002 exactly once; do not replay 001 on existing data. Validate opening balances, role membership and booking snapshots before deploying the matching application. A rollback to old app code cannot safely handle complimentary reservations or the changed RPC signatures: prefer a forward fix, and pause bookings during coordinated rollback. Independent-connection race verification remains a staging requirement.

## Multiple payment options

Migration 003 clears the specifically recognized nonpayable test QR rather than converting it. It converts a legitimate legacy QR/recipient into one ordered `payment_options` entry with a generated UUID and existing instructions. Empty configuration becomes an empty array. Existing booking snapshots are unchanged; new holds snapshot the complete settings. Options contain `id,label,qr_url,recipient,instructions`; there are zero to three complete entries, unique IDs, and at least one when `payment_ready` is true. Admin-only `save_content` validates these rules and mirrors the first entry into legacy fields. Paid guest holds and offering publication check the new array in the database; complimentary/manual behavior is unchanged. Validation helpers have no anonymous/authenticated execute grant and run inside existing security-definer functions.

The separate owner-authorized cleanup script targets one exact fixture ID, slug, name and resource, rejecting bookings without matching fictional payment snapshots. It unpublishes first, clears recognized test content/payment options, removes scoped Storage objects, then dependent email/redemption/payment/receipt/audit rows, bookings and listing. It removes only an unused, named test resource. Requests are sequential, not one database transaction; an ignored private manifest permits scoped retries after partial failure. Real accommodations/accounts are preserved. See [Operations](OPERATIONS.md#system-check-cleanup).

## Appearance and permanent deletion (migration 004)

Optional settings fields preserve existing content. Palette roles: forest, deep, gold, cream, white, text, muted, line, section, buttonText, success/successBg, warning/warningBg, danger/dangerBg. Each value is a six-digit hex color. Images use the named slots in src/lib/appearance.ts; logo and images have a safe src and a nonempty alt of at most 300 characters. Gallery is an ordered array of zero to 20 images. The validation trigger runs on settings inserts/updates, including service-role writes. The helper is private.

Authenticated callers may execute delete_unpaid_booking or delete_cancelled_booking; both call private erase_booking. The owner path checks auth.uid ownership, awaiting_payment, unexpired hold, zero paid, no receipts and no financial entries. The admin path checks membership and cancelled status. Neither grants direct DELETE privileges. Both lock the booking, then its email jobs, reject current sending leases, enqueue storage cleanup, and delete dependencies and booking atomically. Competing receipt submission/review uses the same booking lock. Promo redemptions and financial entries are removed, so promo usage and financial reports change. No booking-specific audit tombstone remains, as explicitly selected by the owner.

receipt_cleanup_jobs is service-only with RLS and no client policies. It holds a unique receipt-folder prefix, finish_after, available_at, locked_at, attempts and last_error. claim_receipt_cleanup_jobs leases up to ten due jobs with SKIP LOCKED; five-minute stale leases may be reclaimed. Retries have no attempt cap. Prefixes remain until an empty scan after the 130-minute window; then jobs are deleted. This handles two-hour signed uploads already issued before deletion. Storage API deletion runs outside SQL; never delete storage.objects directly.

## Migration 005: individual payments, proofs and settings sections

[005_payments_settings.sql](../supabase/migrations/005_payments_settings.sql) preserves gross bookings.paid and existing ledger entries; bookings.refunded is backfilled from refund entries. New payments increase gross paid, including replacement payments after refunds. Ledger methods are cash/gcash/bank/other, with unspecified reserved for legacy entries. Actor already existed and is populated from auth.uid(). No historical method/date is inferred.

record_payment locks the booking, checks staff access, state, integer amount, nonfuture Philippines date, electronic reference and remaining net balance. Online entries require an unlinked receipt belonging to the same booking; linking and payment creation commit together. Cash does not take proof. Confirmation requires the deposit and enqueues one confirmation email atomically. Identical request UUID retries return the current booking; changed amount/method/date/reference/proof/confirmation intent is rejected. Private legacy review functions cannot be called by authenticated clients; review_booking now handles nonfinancial decisions and complimentary approval only.

receipts adds method, payment_option_id, uploaded_by and unique nullable payment_entry_id. Old receipts are retained unlinked with unspecified method. Guest submit_selected_receipt derives the chosen option/method from the original booking snapshot, including legacy single-QR snapshots. This records a claim, not verified funds. Admin record_payment records the verified method. Staff proof uploads use the same private receipts bucket and byte checks, but register_payment_proof does not confirm a booking or add money. Both registration RPCs and prepare_payment_proof are service-role only; they validate the trusted actor/owner and booking. Existing owner/admin receipt RLS is unchanged.

prepare_payment_proof registers staff upload prefixes under the booking lock before signed URL creation. Permanent cancellation deletion queues these prefixes as well as existing receipt prefixes, catching uploads that finish after deletion through the existing grace window. Receipt-to-payment references use ON DELETE SET NULL so the existing financial-then-receipt deletion order remains valid. No new table or bucket is introduced.

Refund insertions update refunded through a private trigger, once per inserted entry. The method-aware refund wrapper preserves idempotency and the net refund limit. finish_booking is idempotent, staff-only and requires confirmed status, arrival reached and zero net balance; it stores finished_at/finished_by. A subsequent refund preserves completion history, reopens payment status and can be settled through a replacement payment on the finished booking. Cancelled/declined/expired bookings cannot receive new payments. Finished stays retain their original capacity interval, avoiding overlapping allocations after early checkout.

save_settings_section locks the settings row and merges only the selected section. Website fields and payment fields have disjoint allowlists; payment saves require a classified method for every option. Existing settings/snapshots remain readable without classification. The existing full save_content is retained for compatibility, and ordinary client table writes remain denied. admin_report includes finished arrival value, net outstanding and dated collections/refunds grouped by method. Undated opening balances remain outside period collections.

## Production operator snapshot

Migration 005 is applied in production. The owner-approved release_backup_005_20261126 schema is outside the public application schema and contains restricted pre-release application-table copies and affected function definitions. Table RLS is enabled and client/service-role schema/table access revoked. It is not queried by the app or a fresh-install requirement, and does not provide an independent backup. Recovery/retention is operator-controlled; see [Operations](OPERATIONS.md#observed-migration-005-rollout).

## Booking experience migration 006

[006](../supabase/migrations/006_booking_experience.sql) replaces quote/hold function signatures with a final p_arrival_time time argument. Public quote/hold wrappers accept a null default only for function-call compatibility; missing/null arrival time is rejected. Private base functions remain nonexecutable by clients/service role. No existing booking, price, schedule snapshot, receipt or payment is rewritten. New snapshots include schedule_policy=arrival_24h and arrival_time.

New email_jobs columns: audience (guest/admin, default guest), event_key (nullable), and a unique event_key/recipient constraint. The private queue helper snapshots verified current admin recipients, normalizes addresses and inserts one job per event/address. Final hold creation explicitly queues after discounts and status are saved; audit triggers queue receipt_submitted and payment_recorded events atomically. Retry paths return before creating another event. A private email trigger adds exact times and the late-arrival policy to new timed guest emails. Old queued emails retain their guest audience. All helpers deny direct client execution; jobs retain existing RLS and deletion behavior.

The bookings_newest index supports creation-time/UUID ordering. Staff RLS still permits all-admin reads; GET /api/bookings separately enforces user_id=authenticated user for personal history. Manual bookings retain null ownership.

## Audit hardening (migration 007)

Availability sums allocation changes at clipped start/end points, combines simultaneous changes and takes the maximum running allocation. It does not sum mutually disjoint reservations across a long request. Existing resource/offering locks, half-open intervals, blackouts, expiry rules and price snapshots remain authoritative.

create_hold serializes each guest under an advisory transaction lock, resolves existing request IDs first, and rejects a fourth unpaid unresolved reservation or an eleventh successful creation in a rolling hour. Counted active rows have paid=0 and are unexpired awaiting_payment or pending_review/correction_requested (including complimentary review). Staff manual reservations are exempt. Three-reservation errors include a release/contact instruction; quota failures use SQLSTATE P0429. Legacy rows over quota remain intact and only new requests are blocked. hold_creation_events has no booking FK so deletion cannot reset the hourly allowance; migration seeds the last hour of retained guest bookings. Cleanup retains events for at least one day.

rate_limit_counters and hold_creation_events have RLS and no direct client/service-role table grants; only definer entry points write them. consume_rate_limit is service-only, atomic across application instances and returns retry seconds or zero. Counters expire after their configured window and are deleted after one additional day, in batches of 1000 per scheduled run. Deleting a booking does not erase this short-lived abuse history.

Public/authenticated execution of booking_quote is revoked. quote_for_actor and public_availability are service-only; the trusted HTTP server supplies a verified actor only for promo/admin quotes. The wrapper uses a transaction-local actor setting for the private legacy calculation and restores it after success; rollback restores it on failure. Manual guest-email quotes repeat the admin check. Private internal booking functions retain execute privileges only for their definer.

Reporting groups entries/created bookings/arrivals by Manila date once, with unchanged totals, period definitions, opening balances and response fields. New indexes cover booking-linked receipt/payment/mail lookups, queue selection, hold expiry/quota reads and blackout resource intervals. Index usefulness under production scale needs PostgreSQL plans; local fixtures do not establish production latency.

email_jobs and receipt_cleanup_jobs gain lease_token UUIDs. Claims rotate tokens; completion/release updates match both job ID and token. Expired sending leases at attempts>=8 transition to failed without another send. pause_email_delivery persists provider cooldown in the private counter table. worker_health returns counts/queue age only. Migration preserves a previously revoked hold grant so a coordinated release does not reopen reservations before resume.
