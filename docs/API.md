# HTTP API reference

Source: [dispatcher](../src/app/api/[...path]/route.ts), [input schemas](../src/lib/validation.ts), [job handler](../src/app/api/jobs/route.ts), and [auth callback](../src/app/auth/callback/route.ts). Endpoint inventory comments below are checked against TypeScript route handlers by `npm run docs:check`.

## Conventions

App POST requests use JSON and must have an `Origin` matching the actual request Host and protocol. Cookie sessions are HTTP-only; use the normal same-origin application session rather than placing credentials in URLs. Booking and staff operations require a verified email. Admin status comes from the database role table.

Money is integer PHP centavos. Dates are `YYYY-MM-DD`; scheduled times are interpreted in Asia/Manila. UUID values are required where indicated. Unknown object fields are stripped by object Zod schemas; client totals and statuses are never authoritative.

Dispatcher failures return {error,code}, with an incident UUID for unexpected failures. Codes include AUTH_REQUIRED/INVALID_CREDENTIALS (401), ADMIN_REQUIRED/EMAIL_UNVERIFIED (403), INVALID_INPUT/INVALID_JSON/REQUEST_REJECTED (400), BODY_TOO_LARGE (413), RATE_LIMITED/HOLD_LIMIT/PROVIDER_LIMIT (429), NOT_CONFIGURED/CLIENT_IDENTITY_UNAVAILABLE/LIMITER_UNAVAILABLE/SERVICE_UNAVAILABLE (503), and INTERNAL_ERROR (500). HTTP 429 includes Retry-After seconds. Unexpected provider/SQL messages stay private; recognized database business errors remain actionable. Unknown routes return 404 and unsupported methods return framework 405. JSON bodies are limited to 256 KiB, including streamed bodies without a truthful Content-Length.

The separate jobs endpoint uses its own 401/503 responses. [Booking row fields and nullability](DATABASE.md) define booking responses; server responses can contain more fields than the UI type lists.

## Identity and reads

<!-- endpoint: GET /api/session -->
### GET /api/session

Public, limited to 120 requests per trusted IP per minute when configured. Returns `{configured, user, admin}`. `user` is null or `{id,email}`. Without Supabase URL/key, returns `{configured:false,user:null,admin:false}`. This is session/configuration state, not proof that all payment/email services are operational.

<!-- endpoint: POST /api/auth -->
### POST /api/auth

Same-origin JSON: `{action,email?,password?,returnTo?}`. Actions: `signup`, `login`, `logout`, `reset`, `password`. Passwords supplied to this handler must be 10–128 characters; email must be valid. Signup/login require both; reset requires email; password update requires verified identity and password. Logout uses the current session.

Optional returnTo accepts only a local /stays/slug destination (including its draft query). Signup and recovery emails carry that destination through the callback. External or malformed destinations are ignored. Signup sends the provider verification email. Reset returns a generic response to avoid exposing whether an email is registered. Signup/login return `{message,session}`; other actions return `{message}`. Successful signup is not always a signed-in session. Auth mail uses Supabase Auth/SMTP configuration, separately from booking email delivery.

<!-- endpoint: GET /auth/callback -->
### GET /auth/callback

Query `code` is exchanged for a session. A validated next=/stays/slug destination resumes the selection after exchange; other successful callbacks go to /account. reset=1 sends the user through /account?reset=1 with the validated next preserved until password update. The legacy next=/account?reset=1 remains supported. Invalid/missing code redirects to /account?error=verification with a safe next preserved. Response is a redirect, not JSON.

<!-- endpoint: GET /api/bookings -->
### GET /api/bookings

Verified account. Returns only rows whose user_id equals the authenticated user ID, with receipts metadata. This server filter applies to admins too; caller-supplied owner filters are ignored. Database staff read permission remains available only for intentional staff workflows. Query page is zero-based (default 0); returns {bookings,total,page}, 50 rows per page, newest created first with UUID tie-breaking. The former bare-array response is replaced; stale account pages must reload. Receipt metadata contains an object path, not a public download URL.

<!-- endpoint: GET /api/admin -->
### GET /api/admin

Verified admin. Returns core offerings/resources/site_content arrays and an empty compatibility blackouts array. Email/activity/blackouts have dedicated paginated endpoints; they are no longer fetched at workspace initialization. Core configuration reads retain the provider row limit. Bookings and reporting use the separate paginated/aggregate endpoints below.

<!-- endpoint: GET /api/receipt -->
### GET /api/receipt

Verified owner or admin. Query `id` is a receipt UUID. Returns `{url}` with a 60-second signed download URL. Treat it as a short-lived credential: do not log, persist, or put it in documentation.

## Quotes and reservations

<!-- endpoint: POST /api/quote -->
### POST /api/quote

Public with configured Supabase. Body: `{offering,arrival,departure,arrival_time,slot?,guests,units,promo?,manual_email?}`. `offering` is a UUID; departure is required for every offering; arrival_time is required in HH:mm format (00:00–23:59). All new reservations span 1–60 whole 24-hour days, ending at that same local time. Legacy slot defaults to empty string and is ignored. Guests: 1–10000; units: 1–1000. SQL adds future-date, max-guest, duration, and availability checks. Quote checks published offerings unless the caller is an admin. A quote does not reserve inventory or a promo use. A promo requires a verified account; manual_email requires admin identity. Promo codes are case-insensitive and normalized to uppercase.

Example (replace the offering UUID with an existing published record):

```json
{"offering":"30000000-0000-4000-8000-000000000001","arrival":"2027-08-01","departure":"2027-08-03","arrival_time":"09:15","slot":"","guests":2,"units":1}
```

Response: `{starts_at,ends_at,allocation,subtotal,discount,promo_code,complimentary,total,deposit,available,remaining,name,nights,deposit_percent}`. Starts/ends are timestamps; nights is the number of booked 24-hour days for every offering. Responses also include arrival_time and schedule_policy=arrival_24h. An unavailable quote can be a successful response with `available:false`.

<!-- endpoint: POST /api/hold -->
### POST /api/hold

Verified account; configured secure storage, booking email settings, app URL, cron secret, and enabled QR instructions for positive totals. Complimentary reservations require the configured booking/email services but not QR instructions. Quote fields plus `{name,phone,request}`: trimmed name 2–120 characters, phone 6–40, request UUID. Reuse the request UUID to retry the same operation; create a new UUID for a new booking attempt. Do not reuse it for changed dates or inventory.

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

Kinds: room/camping/pavilion/day-use. Allocation: unit/guest. Price basis: night/unit/guest. Schedule: overnight/slots. Deposit: 1–100%. At least one image is required; URLs must be HTTPS or allowed shipped image paths. Legacy scheduling fields remain accepted for compatibility but do not control new booking intervals. The editor saves overnight and an empty slot list. If legacy slots are submitted, they use unique `{id,label,start,end}` entries; slots cannot use nightly price basis. Images are limited to 20; amenities 30; slots 30. Positive price and capacity are required by this editor even for drafts. [Input schema](../src/lib/validation.ts) contains field limits.

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

Scheduler only: `Authorization: Bearer <CRON_SECRET>`. Requires configured email settings and service client. Claims up to five jobs at a time (up to 20/run), expires unpaid holds through the claim function, sends guest/staff mail, and returns {processed,sent,cleaned,cleanupFailed}. Admin jobs link to /admin?booking=UUID; guest jobs link to /account. No blanket BCC is sent. `sent` records provider acceptance plus successful database recording, not inbox delivery. Missing/invalid secret: 401. Missing email configuration returns 200 with email status and cleanup counts; queue error returns 503. The implementation's pre-claim configuration check means expiry cleanup also waits for email configuration; availability excludes expired holds regardless. See [operations](OPERATIONS.md) for retries and recovery.

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
Optional query from/until restricts overlapping intervals, status is a booking state, offering is a UUID, query searches guest name/email/reference (max 120 characters), page is zero-based (default 0). Returns {bookings,total,page}, 100 rows/page. Optional order=arrival (default) sorts by arrival then UUID; order=newest sorts by creation time descending then UUID descending. The New bookings view omits date limits and paginates across all arrivals. List view paginates; calendar fetches all pages in its visible date range and reports failure rather than displaying a silently incomplete result. Receipt metadata is loaded only on opening details. Status is the persisted state; an expired unpaid hold may remain awaiting_payment until job cleanup.

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

## Appearance and deletion additions

The existing POST /api/admin/content accepts optional logo ({src,alt}), palette (named six-digit hex colors), images (named page slots with {src,alt}), and gallery (up to 20 ordered {src,alt} items). Legacy settings need no appearance fields. HTTP and a database trigger validate image paths/descriptions, slot names and color roles. Missing roles/images use the original defaults; an explicitly empty gallery stays empty. Public contact email remains the existing email field and does not configure transactional email.

<!-- endpoint: POST /api/bookings/delete -->
### POST /api/bookings/delete

Same-origin verified owner. Body: {booking: UUID}. Returns {ok:true} after the transaction. Only an unexpired awaiting_payment booking with no receipt or recorded payment may be erased. Ownership and status are rechecked under a row lock in delete_unpaid_booking; unauthorized IDs return Booking not found. Other states fail without changes. Inventory and reserved promo usage are released immediately. Repeating a completed deletion returns Booking not found; reload the list after an uncertain response.

<!-- endpoint: POST /api/admin/bookings/delete -->
### POST /api/admin/bookings/delete

Same-origin verified admin. Body: {booking: UUID}; returns {ok:true}. delete_cancelled_booking rechecks membership and permits only cancelled reservations. Permanently removes booking, receipts metadata, payment/refund entries, promo redemptions, booking-specific audit entries and email jobs. Historical reports change. An actively sending email lease blocks deletion with a retry message. Receipt files are queued for asynchronous cleanup; success means database deletion committed, not storage deletion completed.

Daily list reuses GET /api/admin/bookings with from=selected date, until=next date, page and existing filters. It includes all overlapping stays using half-open Philippines-day boundaries and 100-row pages.

GET /api/jobs now processes receipt cleanup before checking email configuration. Normal responses add cleaned and cleanupFailed (job counts, not file counts). If email is unconfigured it returns HTTP 200 with those counts and an email explanation; cleanup still runs. Queue-claim failures return 503. No new environment values are required.

## Individual payments and separate settings (migration 005)

<!-- endpoint: POST /api/admin/payment -->
### POST /api/admin/payment
Same-origin verified admin. Body: {booking,amount,method,day,reference,request,confirm?,receipt?}. Amount is positive integer centavos; method is cash/gcash/bank/other; day is a nonfuture Philippines date; request is an idempotency UUID. confirm defaults false and combines initial payment verification with booking confirmation. receipt is required for electronic payments and must be an unlinked proof on this booking; cash sends null. Electronic references / Other details require 3–2000 characters. Cash notes are optional. Returns the updated booking, including gross paid and refunded. Reusing an identical request is safe; differing financial details are rejected. Amount cannot exceed the net remaining balance. Finished bookings accept only settlement of a reopened balance; other closed states reject payments.

<!-- endpoint: POST /api/admin/finish -->
### POST /api/admin/finish
Same-origin verified admin. Body {booking}; returns updated booking. Requires confirmed, arrived and fully paid; early checkout is allowed. Repeating a successful finish returns the existing finished booking. Does not create money or send another confirmation.

<!-- endpoint: POST /api/admin/settings/website -->
### POST /api/admin/settings/website
Same-origin verified admin. Accepts the existing website fields (appearance, tagline, intro, contact, email, address, cancellation_policy, faq), excluding payment_options/payment_ready. Returns {ok:true}. Strict HTTP validation and a database allowlist prevent cross-section fields. The locked database merge preserves payment settings.

<!-- endpoint: POST /api/admin/settings/payment -->
### POST /api/admin/settings/payment
Same-origin verified admin. Body {payment_options,payment_ready}; each option additionally requires method gcash/bank/other. Existing count/uniqueness/image/recipient/readiness validation applies. Enabling holds retains the server-service configuration check. Returns {ok:true}; preserves website fields. Legacy full /api/admin/content remains supported, but the new UI uses scoped operations.

POST /api/admin/review no longer accepts financial confirmation or balance updates for paid bookings; use /api/admin/payment. Complimentary approval and other reservation decisions remain supported. POST /api/admin/refund additionally accepts method (cash/gcash/bank/other, default cash for HTTP compatibility); refunds reopen payment balance, preserving gross paid and completion status. GET /api/admin/dashboard adds methods [{method,collections,refunds}] and includes finished arrival value/net outstanding. GET /api/admin/booking returns payment entry method/actor and linked receipt metadata; guest booking reads include refunded and completion fields but do not expose the private ledger.

POST /api/upload/prepare and /api/upload/complete additionally support kind payment-proof: verified staff only, booking required, stored in private receipts. Preparation registers the cleanup prefix; completion verifies original bytes and returns the registered receipt row. It does not record funds. Guest receipt completion now also requires option: an ID from that booking's snapshotted payment options. Guest-selected method is derived in SQL; the admin still verifies actual receipt of funds. Existing file type/size/signature, scoped path and ownership checks remain. GET /api/receipt continues issuing 60-second links only for the owner/admin, including staff-uploaded proofs. Do not log signed URLs.

Receipt finalization errors preserve the private object rather than deleting potentially committed evidence on a retry. Unregistered leftovers remain under the booking prefix for its eventual deletion cleanup; failed metadata lookup also prevents invalid-byte cleanup. No automatic orphan-retention SLA is claimed.

## Audit hardening contracts (migration 007)

### Shared limits

Application HTTP limits share atomic counters across server instances. Login/signup/password actions: 10 per trusted IP per 10 minutes; recovery: 10 per trusted IP per hour and 3 per normalized email per hour. Logout is exempt. Quotes and availability share 60 per trusted IP per minute. Authenticated reads share 120 per user/minute and writes 30 per user/minute, except each upload phase has its own 10/user/minute allowance and receipt links have 60/user/minute. Supabase Auth provider limits remain separate. Missing trusted ingress identity, HMAC secret or counter service prevents protected operations with 503. Default window timing starts with the first request; hold creation has the independent rolling-hour rule.

The hold HTTP contract retains its existing payload/booking response. The database rejects a fourth unresolved unpaid guest reservation and an eleventh successful creation within an hour, even through direct authenticated RPC calls. Identical retries do not consume quota again; staff manual bookings are exempt. HTTP maps quota SQLSTATE to HOLD_LIMIT/429 with a 60-second retry hint; active limits still require releasing a hold or staff resolution.

POST /api/quote keeps its response shape but now calls service-only quote_for_actor after input/rate/identity checks. Anonymous/authenticated direct booking_quote execution is revoked. Prices and availability are never cached. Relevant successful admin content/offering/settings saves expire the public catalog tag; direct administrative database edits appear after cache revalidation.

<!-- endpoint: POST /api/availability -->
### POST /api/availability

Same-origin JSON, anonymous: {arrival,departure,arrival_time,guests}, with the same date/time/count requirements as quote. Returns an array of {id,available} for published offerings accepting that guest count, maximum 100 published offerings. Offerings too small for the guest count are omitted. Invalid dates and service failures fail the whole request; this is never a reservation guarantee. One HTTP call and one service RPC replace per-offering HTTP fan-out.

<!-- endpoint: GET /api/admin/emails -->
### GET /api/admin/emails

Verified admin. Query page (zero-based, default 0); returns {rows,total,page}, 100 email jobs/page ordered by created_at descending then UUID. Jobs retain provider-safe failure summaries, attempts and exhausted-job staff retry. No email is sent by reading this endpoint.

<!-- endpoint: GET /api/admin/activity -->
### GET /api/admin/activity

Verified admin. Same pagination envelope/order, 100 audit events/page. Internal activity stays staff-only.

<!-- endpoint: GET /api/admin/blackouts -->
### GET /api/admin/blackouts

Verified admin. Same 100-row pagination; optional from/until ISO dates filter half-open overlap with Philippines day boundaries. Ordered by starts_at descending then UUID. The calendar fetches every page in its visible range and rejects changed/incomplete batches; staff blackout management has explicit pages.

### Worker changes

GET /api/jobs keeps bearer-secret authentication and now limits execution to 60 seconds, with a 40-second processing deadline and bounded provider IO. Claims at most five emails per batch, four batches per run, and two cleanup jobs, matching completion/release by lease_token. Unstarted mail is requeued without consuming an attempt; failed attempts remain retryable up to eight sends. Expired final-attempt leases become failed for staff retry. Provider Retry-After/reset headers and daily/monthly quota responses delay delivery; a shared provider cooldown prevents further queue claims. Conservative shared pacing is one send/second for this application. Returns {processed,sent,deferred,cleaned,cleanupFailed,health}; health contains oldestQueuedSeconds/exhaustedJobs/cleanupFailedJobs or null if its read fails. Missing email configuration returns cleanup counts and an email explanation, still performing abuse-history/storage maintenance. Logs contain counts/timing only. Inbox delivery remains outside the response guarantee.
