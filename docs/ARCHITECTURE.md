# System architecture

Current service deployment follows [ADR 0004](decisions/0004-connected-netlify-services.md): Netlify Next.js hosting, permanent Supabase data, sending-only Resend credential and Vault-backed pg_cron/pg_net worker requests. See [Testing](TESTING.md#connected-services--25-november-2026) for observed evidence and remaining acceptance checks.

## Current system

Netlify is the selected connected host, superseding the original Vercel candidate and the temporary preview-only restriction in [ADR 0003](decisions/0003-temporary-netlify-preview.md). Its automatic Next.js adapter retains dynamic rendering and server routes. Configuration-free preview remains available locally and in nonproduction contexts without live service credentials.

The app uses Next.js App Router, React, TypeScript, semantic CSS tokens, Supabase PostgreSQL/Auth/Storage, and a Resend booking-email adapter. [ADR 0004](decisions/0004-connected-netlify-services.md) records connected hosting; [ADR 0009](decisions/0009-efficient-deployment.md) records assisted/manual deployment and verification. No runtime API or database contract changes accompany the deployment tooling.

| Boundary | Responsibility | Trust |
| --- | --- | --- |
| Browser/client components | Marketing interactions, forms, guest history, staff UI, direct scoped upload | Untrusted input; never decides identity, price, final booking state, or capacity |
| Next.js server pages | Published catalog/settings reads with 30-second data caching | Public content only; preview explicitly labeled when unconfigured |
| Server route handlers | Input validation, same-origin POST checks, verified session/admin checks, storage verification | Service credentials remain in server-only modules |
| Supabase Auth | Accounts, verified email, session/code exchange | Identity verified with provider user checks; not merely a client session flag |
| PostgreSQL functions/RLS | Ownership, staff roles, state machine, money, allocation transactions, outbox | Authoritative persistence and business integrity |
| Supabase Storage | Private receipts and public marketing objects | Scoped signed uploads; receipt read URLs issued after ownership/admin checks |
| Scheduled server handler | Claim jobs, send email, record/retry failures | Bearer-secret authentication and service role; no public browser secret |

## Main flows

Public pages call the [catalog loader](../src/lib/data.ts). Missing URL/key selects preview listings. With configured Supabase, published offerings and public settings are queried; a failed query produces an unavailable state. HTML remains dynamic for fresh script nonces. Public catalog/settings data is cached for 30 seconds, and relevant admin saves immediately expire its cache tag. Quotes and holds always read authoritative database values. Content, images, room mappings, and poster rates are owner-verification tasks, not inferred facts.

Guest booking follows quote → transactionally allocated 30-minute hold → external QR payment → direct original-file upload → server file inspection → pending review → staff verification → confirmation. A quote is informational. A hold can fail even after an available quote because the database rechecks under locks. See [API contracts](API.md) and [state transitions](DATABASE.md).

Staff reads/writes require verified identity plus `admins` membership. SQL functions repeat staff checks where callable by ordinary authenticated clients. Direct client table writes are revoked. Ordinary guest reads are restricted by RLS. The service role bypasses RLS, so every server service-role path must perform explicit identity/record checks first.

## Transactions and external effects

Hold creation locks offering then resource, calculates the server-owned amount/schedule, checks overlapping allocations/blackouts, and inserts a snapshot. Offering edits coordinate with these locks and reject incompatible changes to active pools. Intervals are half-open; money uses integer centavos; schedule conversion uses Asia/Manila.

Discount and complimentary pricing are enforced by the administration wrappers; see DATABASE and ADR 0002. Receipt finalization is executable only by the service role after the HTTP handler verifies owner and file bytes. It accepts a trusted user ID rather than deriving the guest from the service session. Booking transitions and relevant email jobs commit together. HTTP success means persisted state, not that an email arrived.

Email runs later through the outbox. Row locks and leases coordinate claims, retries reuse stable provider idempotency keys, and failures do not undo the booking. Provider acceptance is not inbox-delivery evidence. See [operations](OPERATIONS.md) for timing, limits, and recovery.

## Security and data handling

Server Supabase clients use HTTP-only, same-site cookies; production cookies are secure. Use HTTPS in production. All dispatched POSTs reject missing or foreign Origin against the incoming Host and request protocol, rather than the potentially rewritten internal Next.js hostname. This is an application boundary, not a substitute for database permissions or provider configuration.

Receipts and marketing images use distinct buckets. The server issues a signed upload path scoped to the authorized user and booking where applicable; original bytes bypass function request-size limits. Completion downloads and validates the image signature/size before receipt state changes. Receipt downloads receive 60-second signed URLs. Never log these URLs or include real proof in public documentation.

Settings are publicly readable business content. Keep credentials in environment/secret storage. Guest-visible decision notes are in booking records; internal refund notes remain in admin-only audit detail.

## Limits and known gaps

- Guest history uses 50-row pages; email/activity/blackouts and staff reservations use 100-row pages. Calendar blackouts are loaded for the visible range. Core configuration reads retain the provider row limit; the anonymous batch search supports at most 100 published offerings.
- Manual reservations have no attached guest account, even when an email matches an existing user.
- Draft database prices can be null and manual ownership is nullable; shared UI types do not express every SQL possibility.
- Typed HTTP errors and database business errors have stable response codes; unexpected provider details are suppressed. A small exact list of local validation messages retains compatibility.
- Uploaded proof pending review/correction has no automatic timeout. Staff must resolve it.
- No provider bounce/delivery webhook, automated refunds, gateway, SMS, or channel synchronization exists.
- Live Auth, signed receipt transport, independent capacity contention, deployment and owner inbox delivery passed a fictional check; general guest mail, retention, restore and remaining failure paths are unverified. See TESTING for the precise evidence and limits.

## Change policy

Keep the relevant [handbook reference](README.md), changelog, tests, and current handoff with each change. Record consequential new boundaries/dependencies in an ADR. Preserve original decision history and mark superseded choices rather than rewriting why they were made.

## Multiple QR payments and fixture removal

Payment options remain public site settings and are copied into booking snapshots; administration changes affect future holds. Shared normalization renders legacy single-QR snapshots, while new writes use an ordered array of up to three options. HTTP and database validation enforce completeness, uniqueness, count and readiness. No payment gateway or automatic transfer verification is added. [ADR 0005](decisions/0005-configurable-payment-options.md) records migration and cleanup decisions.

## Appearance and deletion boundary

[ADR 0006](decisions/0006-appearance-and-permanent-deletion.md) records the new behavior. Public settings provide optional appearance fields rendered through server-loaded settings and CSS custom properties; no credentials move into settings. Private SQL helpers enforce deletion status/ownership and atomically queue durable file cleanup. The existing scheduler calls the storage cleanup worker before email processing, independently of mail configuration. No new runtime dependency or environment variable is introduced. Migration 004 is required before the application release.

## Payment recording and settings isolation

[ADR 0007](decisions/0007-payment-ledger-and-settings.md) defines migration 005. Browser selection is proof metadata, while staff verification creates authoritative ledger entries under booking locks. Staff uploads share the private receipt boundary; finalized evidence alone never changes collections. Refund totals are cached on bookings through a trusted insertion trigger so owner reads can show net balance without exposing internal ledger references. Scoped settings merges serialize on the existing settings row. No gateway or new runtime dependency is added.

Catalog uses React request deduplication plus Next data caching for public content only (30-second revalidation and save invalidation). Root rendering waits on connection() so HTML nonces remain per response without disabling the data cache. Private API/auth responses stay private/no-store. Proxy supplies script nonces and a production script policy; inline styles remain permitted for appearance settings. Server-only credential imports remain enforced.

Financial finalization failures retain receipt objects to avoid deleting evidence committed by another retry. Invalid-byte cleanup checks for registered metadata and fails safely if that lookup is unavailable. Eventual cancelled-booking cleanup catches registered staff/guest prefixes; unregistered leftovers on retained bookings need operator retention reconciliation.

## Booking continuation and staff event mail

[ADR 0008](decisions/0008-booking-continuity-and-alerts.md) records migration 006. Personal booking history explicitly filters the authenticated owner even when RLS grants staff-wide reads. Staff visibility remains in verified admin routes.

The browser stores one versioned booking draft for up to 24 hours under ynh-booking-draft-v1; an opaque draft ID and local offering path travel through authentication. Name/phone remain in local storage, never in return URLs; passwords, tokens and payment proof are never saved in the draft. Storage failure is shown, expired/malformed drafts are removed when read, and successful hold/logout clears it. A draft is convenience state: every resumed quote and hold is validated and priced by the server, and holds are created only after confirmation.

Admin alerts are explicit per-event/per-recipient outbox jobs created in the same transaction as final booking/proof/payment changes. Provider failures do not roll back those changes. Recipients are snapshotted at event time; later role changes affect future events. No realtime subscription or delivery webhook is added.

## Audit hardening boundaries (migration 007)

[ADR 0010](decisions/0010-audit-hardening.md) defines peak concurrent allocation, per-guest database quotas, Supabase atomic HTTP counters and service-only quoting. HMAC-derived email/IP/user keys and a bounded private hold-event history are never public settings. HTTP counters use fixed windows starting with the first request; the ten-hold allowance uses a rolling hour. All deployments must share the same HMAC secret. Only Netlify ingress metadata is accepted for anonymous IP identity; generic forwarded headers are ignored. Missing limiter configuration/storage fails closed. Direct Supabase Auth and authenticated reads still require provider-side protections: these application counters govern application HTTP routes, and guest hold quotas govern direct booking RPCs.

Jobs claim at most five emails per batch, up to four batches per run, and two cleanup jobs. Lease tokens guard completion/release; a stale final email attempt becomes visibly failed. Provider 429 responses persist a shared cooldown. Outbox idempotency keys remain stable; delivery acceptance is not inbox delivery. Public catalog caching may serve an earlier public value during revalidation/provider failure; every financial/availability decision remains uncached. Arbitrary external image hosts keep direct delivery; only shipped images and the configured Supabase public marketing path enter the optimizer.
