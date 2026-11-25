# Operations, troubleshooting, and recovery

Start with [configuration](CONFIGURATION.md), [database rules](DATABASE.md), and [release readiness](RELEASE.md). Netlify hosting and permanent Supabase are live. Owner-approved fictional booking, signed storage transport and owner inbox checks passed; general guest mail, verified business configuration and restore remain pending.

## Deployment runbook

### Connected Netlify services

The owner retained Netlify for the connected application. The preview-only instructions below are historical; live now has service settings. Build from protected main with Node 22 and the automatic Next.js adapter. Initial schema installation used SQL Editor to apply exact migrations 001 then 002. This does not establish CLI migration-history entries; do not rerun initial migrations against the installed schema. Use additive migrations and independent backups.

Supabase pg_cron/pg_net runs `ynh-email-outbox` every minute (`* * * * *`), calling the HTTPS `/api/jobs` endpoint with an Authorization Bearer header. It reads the token from Vault secret `ynh_cron_secret`, matching Netlify's protected `CRON_SECRET`; no token literal belongs in saved SQL or documentation. Inspect `cron.job`, `cron.job_run_details` and `net._http_response` as an authorized operator. Cron success only proves HTTP queuing; inspect HTTP response status/content too. Observed responses after redeploy were HTTP 200 with zero jobs. Inbox delivery and maximum-batch duration under Netlify remain unverified.

To pause scheduling, set the named job inactive. Token rotation requires updating Vault and Netlify, redeploying, then checking responses. Pausing Supabase or exhausting provider allowances interrupts scheduled work. `vercel.json` has no scheduling effect on Netlify. Code rollback does not undo database records or service settings.

The sending-only Resend key is a Netlify secret. Default Resend sender and Supabase Auth SMTP restrict recipients; configure an owned verified sender and suitable Auth SMTP before inviting general guests. Verify real offerings and actual payment instructions separately from explicitly labeled system checks.

### Temporary Netlify client review

1. Merge the Netlify setup PR through the required Documentation check and wait for application CI. In the owner's Netlify team, import `florenceWebDev/yvanders-nature-hills` from GitHub, limiting repository authorization to this public repository where possible.
2. Deploy branch `main` from the repository root with Node 22, `npm run build` and publish directory `.next`, as declared in [netlify.toml](../netlify.toml). Use Netlify's automatic Next.js adapter; do not upload `.next` as a static site or configure a catch-all SPA redirect.
3. Request site name `yvanders-nature-hills-preview`, or retain the generated name if unavailable. Leave application service environment values unset in all contexts (including inherited settings) to retain draft listings and the non-saving admin demo. No paid plan or domain purchase is authorized by this setup.
4. Confirm the actual public HTTPS URL and deployed commit. Run `node scripts/smoke.mjs` with `SMOKE_URL` set to that origin, then inspect desktop/mobile pages, direct URL reloads, images, account setup and staff demo. Record results in TESTING and the URL in PLAN/RELEASE. A successful build alone is not hosted verification.
5. Keep Git continuous deployment enabled for main. Updates go through a feature PR and required checks; Netlify rebuilds after merge. Inspect failed deployment logs without sharing secrets. A failed build must not be described as a successful update. To roll back, select a known-good published deploy in Netlify's Deploys history; pause automatic publishing if needed so a later build does not replace the rollback. Revert the source via a protected PR before restoring automatic publication.

This is public demo hosting only. [ADR 0003](decisions/0003-temporary-netlify-preview.md) preserves the separate permanent-hosting decision. A final custom domain can be connected later or pointed at another host. `vercel.json` has no scheduling effect on Netlify; real booking deployment on another host requires an explicitly configured authenticated scheduler and the full release acceptance matrix.

### Live booking release

1. Merge the reviewed feature branch through the protected-main workflow in [CONTRIBUTING](../CONTRIBUTING.md). Record the commit and test evidence.
2. Use isolated staging first. Apply reviewed additive migrations and configure auth callbacks, storage, server environment, sender DNS, and scheduler. Do not rerun the initial migration on an existing database.
3. Run `npm ci`, documentation checks, appropriate tests, and `npm run build`. Deploy the Next.js application to the selected Vercel project; no production project is currently configured. Confirm the actual origin and HTTPS.
4. Exercise registration/verification, availability, competing requests, hold expiry, an original receipt upload, admin decision, and actual guest/staff email on the deployed version. Check guest-to-guest denial and private receipt access directly.
5. Verify backups/restore, support contact, current business policies, QR recipient, prices, capacities, and schedule. Only then enable real bookings. Record observed results in TESTING and RELEASE.

## Scheduled work and email

The [Vercel manifest](../vercel.json) requests a minute schedule for `/api/jobs`. Confirm the hosting plan supports this; otherwise use an external scheduler with the same authenticated request. No browser or user account should trigger this endpoint with a secret in its URL.

The handler requires `Authorization: Bearer <CRON_SECRET>`, email key/from, and the service client. It calls `claim_email_jobs()`, which expires unpaid holds and claims at most 20 due jobs under row locks with SKIP LOCKED. Concurrent workers should not claim the same current lease. Sending leases older than five minutes can be reclaimed.

Jobs move `queued/failed → sending → sent` or `failed`. Attempts increment at claim, with at most eight automatic attempts. Failure delay is `min(1 hour, 30 seconds × 2^attempts)`; starting from attempt one this is 60 seconds. Each send has a 12-second timeout; the handler declares a 300-second duration limit, subject to hosting support. Stable job UUIDs are passed as provider idempotency keys. Do not claim exactly-once delivery across arbitrary outages or provider retention windows.

`sent` means the provider accepted the request and the application recorded success; it does not prove inbox delivery. The current app has no delivery/bounce webhook consumer. Staff receive BCC copies when configured. Balance-only updates create no mail. Receipt acknowledgment and reservation decisions are queued in the same SQL transaction as their state changes.

Staff can retry failed jobs in Email & Activity. Retry resets attempts and availability; it does not send immediately. Inspect actual queue status afterward. Investigate permanently stuck/reclaimed leases with the operator and database before changing records; avoid blindly creating replacement jobs that could duplicate notifications.

## Daily staff tasks

- Review pending and corrected proofs against the actual payment account. Proof alone does not verify funds.
- Resolve pending review/correction rows: they retain capacity without automatic expiry.
- Review failed email jobs and confirm that the scheduler continues running.
- Record cumulative payments and internal refund notes. Refund money through the owner's external process.
- Keep walk-ins, blackouts, rates, and shared-resource relationships consistent with physical inventory.

## Troubleshooting

| Symptom | Inspect | Recovery |
| --- | --- | --- |
| Port 3000 occupied | Another local listener | Use `npm.cmd run dev -- --port 3001`; do not terminate an unrelated process |
| Preview shown unexpectedly | URL/key presence and server restart | Configure the intended staging environment; preview is expected without these values |
| Connected catalog unavailable | Migration, published rows, RLS, correct project | Fix configuration/query failure; do not replace errors with fake bookable records |
| Account verification/reset fails | Supabase callback allowlist, origin, SMTP, link age | Correct provider settings and request a fresh link; do not copy session codes into logs |
| Admin access denied | Verified account and `admins` membership | Authorized owner promotes the correct user; hiding UI is not a fix |
| Payment activation/hold rejected | Required settings, QR/recipient, account verification | Complete setup and test staging; presence of keys alone is insufficient |
| Dates unavailable | Active allocations, shared pool, blackouts, configured timezone/slots | Choose another date or investigate physical inventory; do not override capacity casually |
| Screenshot upload fails | Ownership, hold expiry, actual JPEG/PNG/WebP bytes, size ≤10 MB, bucket setup | Retry original upload if still eligible; paid-after-expiry cases require staff review without a second payment |
| Confirmation email missing | Booking state, outbox, scheduler, sender/domain/provider response | Resolve delivery issue and retry failed job; booking remains persisted |
| Expired rows still say awaiting payment | Email configuration and claim-job execution | Availability already excludes expired holds; repair scheduled cleanup rather than reallocating blindly |
| Older bookings missing from dashboard | Current 500-row cap | Implement pagination before operating at this scale; UI search only covers loaded rows |
| Docs check fails | Named affected reference, inventory marker, relative link, Git base | Update the relevant handbook/changelog and rerun; see CONTRIBUTING |

## Recovery and change management

Record the deployed application version and migration state before changing them. Roll back application code through hosting only after checking database compatibility. Prefer an additive forward fix for schema/data issues; code rollback does not undo migrations, verified payments, or sent emails.

Agree backup frequency, retention, acceptable data loss, and restore ownership with the campsite owner. Demonstrate restore into an isolated project with application permissions before calling recovery verified. No restore procedure has yet been exercised against the owner's live service.

For credential exposure: stop using the affected key, rotate it with the provider, update all server/scheduler environments, and assess public Git history separately. Removing a value from the latest commit does not remove historical exposure. Never include real guest data or payment proof in a public issue.

## Documentation merge gate

The `Documentation check` workflow uses Node 22 and needs no Supabase/Resend secrets. It runs on all pull requests to main, pushes to main, and manual dispatch; it has read-only repository permission and no path filter that could leave a required job missing. Checkout credentials are not persisted.

It tests its own checker, verifies links/inventories, then assesses documentation impact against the event's base/head. Pull requests use the three-dot merge-base diff; pushes use the exact before/after diff. Local checks include untracked files and tracked working changes. Documentation-only changes do not require unrelated changelog/reference edits.

Verified on 25 November 2026: the active [Main documentation gate ruleset](https://github.com/florenceWebDev/yvanders-nature-hills/settings/rules/28036246) targets `refs/heads/main`, requires pull requests and the `Documentation check` from GitHub Actions, has an empty bypass list (including administrators), and blocks force pushes and deletion. Required independent approvals are zero, so the sole owner can merge their own passing PR. Branch-up-to-date enforcement is not enabled. Preserve these protections when changing repository settings. Rule configuration is external state: reverify it after settings changes. See [Testing](TESTING.md) for the actual accepted/rejected PR evidence.

## Staff, promos and reporting operations

Deploy migration 002 before the matching app. Bootstrap the first administrator as before; additional verified accounts are promoted by email in Administrators. Each admin has equal power. At least one must remain. Before removing your own membership, ensure another operator can sign in.

Review complimentary requests alongside payment review; they reserve inventory indefinitely until approved, declined or cancelled. Never request or upload payment proof for a zero-total reservation. Promo usage displays reserved and permanently consumed counts; disabling a code prevents new uses but does not alter existing reservations. Codes cannot be renamed.

Record cumulative verified payments with their actual received date. Record a refund only after it is completed externally, with a reference; cancelling is separate and does not imply a refund. Reports separate gross collections, refunds and net collections from confirmed arrival value, not profit. Undated migrated opening balances are excluded from trends and require operator reconciliation if historical reports are needed. Weeks begin Monday; all calendar/report dates use Asia/Manila.

Staff reservation lists paginate and calendars fetch all range pages. A load failure is an error, not zero bookings. Configuration/resources/offerings/blackouts and email/audit bundles still cap at 500 rows; expand these separately before inventory/configuration reaches that size. Public guest history retains its 500-row cap. Live auth, email transport and independent database races require staging acceptance; local PGlite serializes queries.


Application CI now installs the lockfile, runs npm test, and builds on Node 22 for PRs/pushes. Documentation remains the required main-branch gate; wait for both jobs before merging application changes. Preview smoke checks now include every new admin read/write endpoint failing closed without services.

Reverse proxies must preserve the incoming Host and request protocol for same-origin validation. The handler does not trust an arbitrary forwarded-host header.
