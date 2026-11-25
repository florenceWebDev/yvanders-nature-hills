# System architecture

Current service deployment follows [ADR 0004](decisions/0004-connected-netlify-services.md): Netlify Next.js hosting, permanent Supabase data, sending-only Resend credential and Vault-backed pg_cron/pg_net worker requests. See [Testing](TESTING.md#connected-services--25-november-2026) for observed evidence and remaining acceptance checks.

## Current system

Temporary client review uses Netlify with the existing configuration-free preview path; see [ADR 0003](decisions/0003-temporary-netlify-preview.md). The original Vercel target below is a production candidate, not a completed deployment or final hosting commitment. Netlify's automatic Next.js adapter retains dynamic rendering and server routes; no application API or database contract changes are needed.

The app uses Next.js App Router, React, TypeScript, semantic CSS tokens, Supabase PostgreSQL/Auth/Storage, and a Resend booking-email adapter. Vercel is the intended hosting destination; live hosting and provider configuration have not been completed. See the [accepted baseline decision](decisions/0001-application-baseline.md).

| Boundary | Responsibility | Trust |
| --- | --- | --- |
| Browser/client components | Marketing interactions, forms, guest history, staff UI, direct scoped upload | Untrusted input; never decides identity, price, final booking state, or capacity |
| Next.js server pages | Per-request published catalog and settings reads | Public content only; preview explicitly labeled when unconfigured |
| Server route handlers | Input validation, same-origin POST checks, verified session/admin checks, storage verification | Service credentials remain in server-only modules |
| Supabase Auth | Accounts, verified email, session/code exchange | Identity verified with provider user checks; not merely a client session flag |
| PostgreSQL functions/RLS | Ownership, staff roles, state machine, money, allocation transactions, outbox | Authoritative persistence and business integrity |
| Supabase Storage | Private receipts and public marketing objects | Scoped signed uploads; receipt read URLs issued after ownership/admin checks |
| Scheduled server handler | Claim jobs, send email, record/retry failures | Bearer-secret authentication and service role; no public browser secret |

## Main flows

Public pages call the [catalog loader](../src/lib/data.ts). Missing URL/key selects preview listings. With configured Supabase, published offerings and public settings are queried; a failed query produces an unavailable state. Server rendering is dynamic so admin content changes can appear on later requests. Content, images, room mappings, and poster rates are owner-verification tasks, not inferred facts.

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

- Guest history and the legacy configuration/email/audit bundle cap at 500 rows. Staff reservations use 100-row pages and range fetching; dashboard SQL aggregates all matching bookings and payment entries.
- Manual reservations have no attached guest account, even when an email matches an existing user.
- Draft database prices can be null and manual ownership is nullable; shared UI types do not express every SQL possibility.
- Dispatcher error status mapping depends on message text; there are no stable typed error codes.
- Uploaded proof pending review/correction has no automatic timeout. Staff must resolve it.
- No provider bounce/delivery webhook, automated refunds, gateway, SMS, or channel synchronization exists.
- Live Auth, signed receipt transport, independent capacity contention, deployment and owner inbox delivery passed a fictional check; general guest mail, retention, restore and remaining failure paths are unverified. See TESTING for the precise evidence and limits.

## Change policy

Keep the relevant [handbook reference](README.md), changelog, tests, and current handoff with each change. Record consequential new boundaries/dependencies in an ADR. Preserve original decision history and mark superseded choices rather than rewriting why they were made.
