# HTTP API reference

Source: [dispatcher](../src/app/api/[...path]/route.ts), [input schemas](../src/lib/validation.ts), [job handler](../src/app/api/jobs/route.ts), and [auth callback](../src/app/auth/callback/route.ts). Endpoint inventory comments below are checked against TypeScript route handlers by `npm run docs:check`.

## Conventions

App POST requests use JSON and must have an `Origin` matching the actual request Host and protocol. Cookie sessions are HTTP-only; use the normal same-origin application session rather than placing credentials in URLs. Booking and staff operations require a verified email. Admin status comes from the database role table.

Money is integer PHP centavos. Dates are `YYYY-MM-DD`; scheduled times are interpreted in Asia/Manila. UUID values are required where indicated. Unknown object fields are stripped by object Zod schemas; client totals and statuses are never authoritative.

The dispatcher returns `{ "error": "message" }`: 401 when the message matches “Sign in”, 403 when it matches “Admin access”, otherwise 400. This is the current message-based mapping, not a general typed error contract. Verification failures and missing service configuration can therefore return 400. Unknown dispatched routes return 404; unsupported HTTP methods return framework 405. Do not depend on database error text as a stable machine code.

The separate jobs endpoint uses its own 401/503 responses. [Booking row fields and nullability](DATABASE.md) define booking responses; server responses can contain more fields than the UI type lists.

## Identity and reads

<!-- endpoint: GET /api/session -->
### GET /api/session

Public. Returns `{configured, user, admin}`. `user` is null or `{id,email}`. Without Supabase URL/key, returns `{configured:false,user:null,admin:false}`. This is session/configuration state, not proof that all payment/email services are operational.

<!-- endpoint: POST /api/auth -->
### POST /api/auth

Same-origin JSON: `{action,email?,password?}`. Actions: `signup`, `login`, `logout`, `reset`, `password`. Passwords supplied to this handler must be 10–128 characters; email must be valid. Signup/login require both; reset requires email; password update requires verified identity and password. Logout uses the current session.

Signup sends the provider verification email. Reset returns a generic response to avoid exposing whether an email is registered. Signup/login return `{message,session}`; other actions return `{message}`. Successful signup is not always a signed-in session. Auth mail uses Supabase Auth/SMTP configuration, separately from booking email delivery.

<!-- endpoint: GET /auth/callback -->
### GET /auth/callback

Query `code` is exchanged for a session. Only `next=/account?reset=1` is specially allowed; other successful callbacks go to `/account`. Invalid/missing code redirects to `/account?error=verification`. Response is a redirect, not JSON.

<!-- endpoint: GET /api/bookings -->
### GET /api/bookings

Verified account. Returns an array of accessible booking rows with `receipts` metadata. RLS limits guests to their own rows; staff identities may see all rows. Newest created rows first, capped at 500; there is no pagination parameter yet. Receipt metadata contains an object path, not a public download URL.

<!-- endpoint: GET /api/admin -->
### GET /api/admin

Verified admin. Returns `{offerings,resources,blackouts,site_content,email_jobs,audit_events}`, each an array capped at 500. Emails and audit events sort by creation descending. Bookings and reporting use the separate range/paginated and aggregate endpoints below. This changes the previous bundled admin response.

<!-- endpoint: GET /api/receipt -->
### GET /api/receipt

Verified owner or admin. Query `id` is a receipt UUID. Returns `{url}` with a 60-second signed download URL. Treat it as a short-lived credential: do not log, persist, or put it in documentation.

## Quotes and reservations

<!-- endpoint: POST /api/quote -->
### POST /api/quote

Public with configured Supabase. Body: `{offering,arrival,departure?,slot?,guests,units,promo?,manual_email?}`. `offering` is a UUID; `departure` may be null for slots; slot defaults to empty string. Guests: 1–10000; units: 1–1000. SQL adds future-date, max-guest, duration, and availability checks. Quote checks published offerings unless the caller is an admin. A quote does not reserve inventory or a promo use. A promo requires a verified account; manual_email requires admin identity. Promo codes are case-insensitive and normalized to uppercase.

Example (replace the offering UUID with an existing published record):

```json
{"offering":"30000000-0000-4000-8000-000000000001","arrival":"2027-08-01","departure":"2027-08-03","slot":"","guests":2,"units":1}
```

Response: `{starts_at,ends_at,allocation,subtotal,discount,promo_code,complimentary,total,deposit,available,remaining,name,nights,deposit_percent}`. Starts/ends are timestamps; `nights` is 1 for a venue slot. An unavailable quote can be a successful response with `available:false`.

<!-- endpoint: POST /api/hold -->
### POST /api/hold

Verified account; configured secure storage, booking email settings, app URL, admin email, cron secret, and enabled QR instructions for positive totals. Complimentary reservations require the configured booking/email services but not QR instructions. Quote fields plus `{name,phone,request}`: trimmed name 2–120 characters, phone 6–40, request UUID. Reuse the request UUID to retry the same operation; create a new UUID for a new booking attempt. Do not reuse it for changed dates or inventory.

Returns a booking row with `awaiting_payment` and a 30-minute expiry for positive totals. A valid promo reducing total to zero instead returns `pending_review` with deposit zero, reserves capacity until staff resolve it, and queues an approval-pending email. It does not request a receipt. Price, deposit, time period, and payment settings are snapshotted. A race for the last unit returns an error from the transaction; choose dates again rather than trusting an earlier quote.

<!-- endpoint: POST /api/admin/manual -->
### POST /api/admin/manual

Verified admin. Same hold fields plus required `manual_email`. Creates a confirmed staff reservation using the same allocation checks, and queues an email. Manual rows have `user_id:null`; they are staff-managed and are not automatically attached to a guest account with the same email. Payment is initially zero and can be recorded separately. Admins may use unpublished offerings with a configured rate.

## Original image uploads

<!-- endpoint: POST /api/upload/prepare -->
### POST /api/upload/prepare

Verified owner for `kind:receipt`; verified admin for `kind:marketing`. Body: `{kind,booking?,mime,size}`. A receipt requires a positive-total owned booking accepting proof; expired unpaid holds are rejected. MIME: `image/jpeg`, `image/png`, or `image/webp`; size: 1–10485760 bytes.

Returns `{url,id,ext}`. PUT the original file bytes to `url` with matching Content-Type and `x-upsert:false`. This goes directly to Supabase storage, avoiding the hosting function's request-size limit. The signed URL does not confirm payment or finalize a receipt.

<!-- endpoint: POST /api/upload/complete -->
### POST /api/upload/complete

Same authorization. Body: `{kind,id,ext,booking?,reference?}`; ext is `jpg`, `png`, or `webp`. A receipt requires booking UUID and transaction reference of 3–120 trimmed characters. The server reconstructs the object path, downloads the bytes, checks size/signature/extension, and removes invalid files.

Marketing returns `{url}` for the public image. Receipt completion invokes the service-only SQL function and returns a booking row in `pending_review`, with a transactional acknowledgment email. Repeating completion with the same receipt ID is idempotent. New submissions are accepted only in allowed booking states; if the hold expires after payment, contact staff instead of paying again.

## Staff writes

All operations below require verified admin identity and same-origin JSON.

<!-- endpoint: POST /api/admin/review -->
### POST /api/admin/review

Body: `{booking,action,note?,paid?,refund?,occurred?,request?}`. Optional occurred is a nonfuture received date in Philippines time (defaults today); request is a retry UUID for the payment ledger. Actions: `confirm`, `decline`, `correction`, `cancel`, `balance`. `paid` is cumulative verified centavos, not a new payment delta. Confirmation must cover deposit and not exceed total. Balance updates cannot decrease the verified amount or exceed total. Decline/correction/cancel require a reason of at least three characters. Notes/refund records are capped at 2000 characters.

Returns the updated booking row. `note` is guest-visible; refund text is stored in admin-only audit detail. Refunds occur outside the application. Positive increases in cumulative paid create payment ledger deltas in the same transaction; repeated unchanged amounts create no additional entry. Complimentary approvals require paid=0 and cannot request corrected proof. Decisions queue email except balance-only updates. See [allowed transitions](DATABASE.md).

<!-- endpoint: POST /api/admin/offering -->
### POST /api/admin/offering

Creates/updates an offering. Body fields: optional UUID `id` and `resource_id`; `slug`, `name`, `kind`, `description`, `images`, `amenities`, `published`, `allocation_basis`, `max_guests`, `capacity`, `price`, `price_basis`, `deposit_percent`, `schedule`, `check_in`, `check_out`, `slots`.

Kinds: room/camping/pavilion/day-use. Allocation: unit/guest. Price basis: night/unit/guest. Schedule: overnight/slots. Deposit: 1–100%. At least one image is required; URLs must be HTTPS or allowed shipped image paths. Slots use unique `{id,label,start,end}` entries; slots cannot use nightly price basis. Images are limited to 20; amenities 30; slots 30. Positive price and capacity are required by this editor even for drafts. [Input schema](../src/lib/validation.ts) contains field limits.

Omit resource ID to create a new pool; provide it to share an existing pool. Active reservations prevent pool reassignment and capacity changes. Publishing requires enabled payment settings and a rate. Returns `{id}`. Archive by setting `published:false`; existing bookings remain.

<!-- endpoint: POST /api/admin/content -->
### POST /api/admin/content

Replaces settings using `{tagline,intro,contact,email,address,payment_options,payment_ready,cancellation_policy,faq?}`. Each ordered payment option is `{id,label,qr_url,recipient,instructions}`: unique UUID, nonblank label (max 100), HTTPS or supplied image path (max 2048), nonblank recipient (max 200), and instructions (string, may be empty, max 4000). Maximum three options; zero is allowed only while payments are disabled. Incomplete entries are rejected even when disabled. FAQ entries are `{question,answer}`. Enabling payment also requires the server-side service settings listed under hold. Returns `{ok:true}`; validation failures return 400 and nonadmins are denied. Images use the existing admin-only marketing upload flow. Migration 003 repeats payment validation in `save_content` for direct RPC callers and mirrors the first option into legacy fields during deployment. Old booking snapshots remain readable. Settings are public content; never store credentials here.

<!-- endpoint: POST /api/admin/blackout -->
### POST /api/admin/blackout

Body `{resource,start,end,reason}`. Resource is a UUID; timestamps include a timezone offset; reason 3–500 characters. Start/end must form a valid positive interval; overlapping active reservations are rejected. Returns `{ok:true}`.

<!-- endpoint: POST /api/admin/blackout/remove -->
### POST /api/admin/blackout/remove

Body `{id}` with blackout UUID. Deletes that blackout and writes an audit event. Returns `{ok:true}`; removing an absent ID is not a not-found error.

<!-- endpoint: POST /api/admin/email/retry -->
### POST /api/admin/email/retry

Body `{id}` with job UUID. Resets a failed job to queued, attempts zero, and immediate availability using the service role. Does not send synchronously. Returns `{ok:true}` even when no failed row matches; inspect Email & Activity for actual outcome.

<!-- endpoint: GET /api/jobs -->
### GET /api/jobs

Scheduler only: `Authorization: Bearer <CRON_SECRET>`. Requires configured email settings and service client. Claims up to 20 jobs, expires unpaid holds through the claim function, sends booking mail, and returns `{processed,sent}`. `sent` records provider acceptance plus successful database recording, not inbox delivery. Missing/invalid secret: 401. Missing email configuration or queue error: 503. The implementation's pre-claim configuration check means expiry cleanup also waits for email configuration; availability excludes expired holds regardless. See [operations](OPERATIONS.md) for retries and recovery.

## Expanded administration

All endpoints in this section require a verified administrator. POSTs also require the matching Origin. Guests cannot invoke the corresponding SQL admin operations directly.

<!-- endpoint: GET /api/admin/admins -->
### GET /api/admin/admins
Returns an array of {user_id,email}. All administrators have equal privileges. No general guest directory is exposed.

<!-- endpoint: POST /api/admin/admins/add -->
### POST /api/admin/admins/add
Body {email}; returns {id}. Exact case-insensitive verified-account lookup. Unknown/unverified accounts and existing administrators return an error. Does not create an Auth account or send an invitation.

<!-- endpoint: POST /api/admin/admins/remove -->
### POST /api/admin/admins/remove
Body {id}; returns {id}. Removes membership only, preserving the account and bookings. Serialized with other membership writes; the last administrator cannot be removed. Self-removal is allowed while another administrator remains. Further admin requests recheck membership.

<!-- endpoint: GET /api/admin/dashboard -->
### GET /api/admin/dashboard
Query from/until are ISO dates, with until exclusive; optional offering UUID. Range must be 1–366 days. Returns bookings (created count), statuses (created-cohort counts), booking_value and outstanding (currently confirmed arrivals), collections/refunds (effective transaction date), opening (all undated opening collections), daily (date,bookings,collections,refunds,booking_value), and offerings (offering_id,offering_name,bookings,booking_value). All monetary fields are centavos. Aggregation spans all matching records; it does not use the 500-row bundle. The browser requests the preceding period separately for comparisons.

<!-- endpoint: GET /api/admin/bookings -->
### GET /api/admin/bookings
Optional query from/until restricts overlapping intervals, status is a booking state, offering is a UUID, query searches guest name/email/reference (max 120 characters), page is zero-based (default 0). Returns {bookings,total,page}, 100 rows/page sorted by arrival then UUID. List view paginates; calendar fetches all pages in its visible date range and reports failure rather than displaying a silently incomplete result. Receipt metadata is loaded only on opening details. Status is the persisted state; an expired unpaid hold may remain awaiting_payment until job cleanup.

<!-- endpoint: GET /api/admin/booking -->
### GET /api/admin/booking
Query id UUID. Returns a booking row with receipts and payments. Payments contain id,kind,amount,occurred_at,reference and audit fields; undated opening entries have occurred_at=null. Neither object paths nor metadata grant receipt download access; use the protected receipt endpoint.

<!-- endpoint: GET /api/admin/promos -->
### GET /api/admin/promos
Returns promo definitions plus reserved and consumed counts. Reserved includes unexpired unpaid holds and unresolved review reservations; consumed uses remain counted after paid/approved bookings are cancelled.

<!-- endpoint: POST /api/admin/promo -->
### POST /api/admin/promo
Body {id?,code,enabled,kind,value,max_discount,min_subtotal,offering_ids,booking_from,booking_until,stay_from,stay_until,usage_limit,customer_limit}; returns {id}. kind is percent or fixed. Percent value uses basis points (2500 = 25%, 10000 = 100%); fixed values and amount caps/minimums use centavos. Optional caps, limits and date boundaries are null, offering_ids=[] means all accommodations. Limits are positive integers; dates are inclusive local dates. Stay boundaries cover every occupied calendar date including departure date when occupied. Code is 3–40 uppercase letters/digits/underscore/hyphen and immutable after creation. Disable instead of deleting. One promo applies per booking. Server calculates/clamps the discount to the subtotal and revalidates under locks when reserving. manual_email establishes the guest email for staff reservations; ordinary guests use their verified account email.

<!-- endpoint: POST /api/admin/refund -->
### POST /api/admin/refund
Body {booking,amount,day,reference,request}; returns {id}. amount is positive centavos, day is a nonfuture Philippines date, reference is 3–2000 characters, request is a retry UUID. Records a completed external refund; does not move funds or cancel the booking. Cannot exceed verified payment/opening entries minus earlier refunds. Identical retries do not add another refund; reusing a UUID with different refund details is rejected. Gross paid is retained; refunds and net collections are reported separately.
