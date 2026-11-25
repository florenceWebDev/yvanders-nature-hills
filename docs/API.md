# HTTP API reference

Source: [dispatcher](../src/app/api/[...path]/route.ts), [input schemas](../src/lib/validation.ts), [job handler](../src/app/api/jobs/route.ts), and [auth callback](../src/app/auth/callback/route.ts). Endpoint inventory comments below are checked against TypeScript route handlers by `npm run docs:check`.

## Conventions

App POST requests use JSON and must have an `Origin` matching the application origin. Cookie sessions are HTTP-only; use the normal same-origin application session rather than placing credentials in URLs. Booking and staff operations require a verified email. Admin status comes from the database role table.

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

Verified admin. Returns `{offerings,resources,bookings,blackouts,site_content,email_jobs,audit_events}`, each an array capped at 500. Booking rows include receipts. Bookings, emails, and audit events sort by creation descending; other tables have no explicit ordering. Dashboard totals/filtering operate on the loaded subset.

<!-- endpoint: GET /api/receipt -->
### GET /api/receipt

Verified owner or admin. Query `id` is a receipt UUID. Returns `{url}` with a 60-second signed download URL. Treat it as a short-lived credential: do not log, persist, or put it in documentation.

## Quotes and reservations

<!-- endpoint: POST /api/quote -->
### POST /api/quote

Public with configured Supabase. Body: `{offering,arrival,departure?,slot?,guests,units}`. `offering` is a UUID; `departure` may be null for slots; slot defaults to empty string. Guests: 1–10000; units: 1–1000. SQL adds future-date, max-guest, duration, and availability checks. Quote checks published offerings unless the caller is an admin. A quote does not reserve inventory.

Example (replace the offering UUID with an existing published record):

```json
{"offering":"30000000-0000-4000-8000-000000000001","arrival":"2027-08-01","departure":"2027-08-03","slot":"","guests":2,"units":1}
```

Response: `{starts_at,ends_at,allocation,total,deposit,available,remaining,name,nights,deposit_percent}`. Starts/ends are timestamps; `nights` is 1 for a venue slot. An unavailable quote can be a successful response with `available:false`.

<!-- endpoint: POST /api/hold -->
### POST /api/hold

Verified account; configured secure storage, booking email settings, app URL, admin email, cron secret, and enabled QR payment instructions. Quote fields plus `{name,phone,request}`: trimmed name 2–120 characters, phone 6–40, request UUID. Reuse the request UUID to retry the same operation; create a new UUID for a new booking attempt. Do not reuse it for changed dates or inventory.

Returns a booking row with `awaiting_payment` and a 30-minute expiry. Price, deposit, time period, and payment settings are snapshotted. A race for the last unit returns an error from the transaction; choose dates again rather than trusting an earlier quote.

<!-- endpoint: POST /api/admin/manual -->
### POST /api/admin/manual

Verified admin. Same hold fields plus required `manual_email`. Creates a confirmed staff reservation using the same allocation checks, and queues an email. Manual rows have `user_id:null`; they are staff-managed and are not automatically attached to a guest account with the same email. Payment is initially zero and can be recorded separately. Admins may use unpublished offerings with a configured rate.

## Original image uploads

<!-- endpoint: POST /api/upload/prepare -->
### POST /api/upload/prepare

Verified owner for `kind:receipt`; verified admin for `kind:marketing`. Body: `{kind,booking?,mime,size}`. A receipt requires an owned booking accepting proof; expired unpaid holds are rejected. MIME: `image/jpeg`, `image/png`, or `image/webp`; size: 1–10485760 bytes.

Returns `{url,id,ext}`. PUT the original file bytes to `url` with matching Content-Type and `x-upsert:false`. This goes directly to Supabase storage, avoiding the hosting function's request-size limit. The signed URL does not confirm payment or finalize a receipt.

<!-- endpoint: POST /api/upload/complete -->
### POST /api/upload/complete

Same authorization. Body: `{kind,id,ext,booking?,reference?}`; ext is `jpg`, `png`, or `webp`. A receipt requires booking UUID and transaction reference of 3–120 trimmed characters. The server reconstructs the object path, downloads the bytes, checks size/signature/extension, and removes invalid files.

Marketing returns `{url}` for the public image. Receipt completion invokes the service-only SQL function and returns a booking row in `pending_review`, with a transactional acknowledgment email. Repeating completion with the same receipt ID is idempotent. New submissions are accepted only in allowed booking states; if the hold expires after payment, contact staff instead of paying again.

## Staff writes

All operations below require verified admin identity and same-origin JSON.

<!-- endpoint: POST /api/admin/review -->
### POST /api/admin/review

Body: `{booking,action,note?,paid?,refund?}`. Actions: `confirm`, `decline`, `correction`, `cancel`, `balance`. `paid` is cumulative verified centavos, not a new payment delta. Confirmation must cover deposit and not exceed total. Balance updates cannot decrease the verified amount or exceed total. Decline/correction/cancel require a reason of at least three characters. Notes/refund records are capped at 2000 characters.

Returns the updated booking row. `note` is guest-visible; refund text is stored in admin-only audit detail. Refunds occur outside the application. Decisions queue email except balance-only updates. See [allowed transitions](DATABASE.md).

<!-- endpoint: POST /api/admin/offering -->
### POST /api/admin/offering

Creates/updates an offering. Body fields: optional UUID `id` and `resource_id`; `slug`, `name`, `kind`, `description`, `images`, `amenities`, `published`, `allocation_basis`, `max_guests`, `capacity`, `price`, `price_basis`, `deposit_percent`, `schedule`, `check_in`, `check_out`, `slots`.

Kinds: room/camping/pavilion/day-use. Allocation: unit/guest. Price basis: night/unit/guest. Schedule: overnight/slots. Deposit: 1–100%. At least one image is required; URLs must be HTTPS or allowed shipped image paths. Slots use unique `{id,label,start,end}` entries; slots cannot use nightly price basis. Images are limited to 20; amenities 30; slots 30. Positive price and capacity are required by this editor even for drafts. [Input schema](../src/lib/validation.ts) contains field limits.

Omit resource ID to create a new pool; provide it to share an existing pool. Active reservations prevent pool reassignment and capacity changes. Publishing requires enabled payment settings and a rate. Returns `{id}`. Archive by setting `published:false`; existing bookings remain.

<!-- endpoint: POST /api/admin/content -->
### POST /api/admin/content

Replaces settings using `{tagline,intro,contact,email,address,qr_url,payment_recipient,payment_instructions,payment_ready,cancellation_policy,faq?}`. FAQ entries are `{question,answer}`. Empty contact email/QR are allowed while configuring. Enabling payment requires QR/recipient plus the server-side service settings listed under hold. Returns `{ok:true}`. Settings are public content; never store credentials here.

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
