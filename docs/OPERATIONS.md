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

`sent` means the provider accepted the request and the application recorded success; it does not prove inbox delivery. The current app has no delivery/bounce webhook consumer. After migration 006, explicit staff jobs notify verified current admins of new bookings, guest proof and recorded/verified payments, including balances. The worker sends no blanket BCC. Each recipient retries independently; recipient membership is captured at event time. Receipt acknowledgment and reservation decisions are queued in the same SQL transaction as their state changes.

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
| Dates unavailable | Active allocations, shared pool, blackouts, selected arrival time and Philippines timezone | Choose another date or investigate physical inventory; do not override capacity casually |
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

## Multiple QR rollout

Apply [migration 003](../supabase/migrations/003_payment_options.sql) once after 002, then deploy the matching application through a passing feature PR. It preserves booking snapshots, converts legacy settings and retains first-option mirrors for the old reader. Do not roll back to an old settings writer: it cannot save the new array contract. Forward-fix the migration; app rollback does not undo settings/data. The new app can read legacy configuration before migration, but multi-QR writes and direct database enforcement require 003. Verify real payment images/recipients before enabling holds or publishing real accommodations.

## System-check cleanup

The owner-approved fixture was removed on 26 November 2026. [The cleanup script](../scripts/remove-system-check.mjs) supports preflight and apply:

```powershell
node --env-file=.env.local scripts/remove-system-check.mjs
node --env-file=.env.local scripts/remove-system-check.mjs --apply
```

Use existing service configuration from a trusted operator terminal. Preflight validates exact identity, fictional snapshots and receipt scope; unexpected dependencies stop cleanup. Apply unpublishes first and compares current settings before changing recognized fixture content. It removes only identified records/files, leaves real accounts/drafts intact and disables readiness when the test QR is removed. It does not republish real offerings. The private ignored `.env-check/system-check-cleanup.json` holds scoped IDs/paths for retries; never commit it. Keep it until verification succeeds. On failure, inspect the error and rerun the same script; do not broaden IDs or delete shared resources. This multi-request operation is resumable rather than atomic. Previously sent fictional emails cannot be recalled; app rollback cannot restore deleted test history.

## Migration 004 and permanent-deletion recovery

Apply 004_appearance_deletion.sql after 003 and before this application is deployed, first on isolated staging. Confirm the trigger rejects invalid appearance values and nonadmins cannot save or delete cancelled bookings. Verify owner-only active unpaid deletion, cancelled paid deletion and released capacity with fictional data. Migration 004 is transactional and additive: it does not delete existing bookings or alter saved appearance automatically.

The existing authenticated GET /api/jobs scheduler processes receipt_cleanup_jobs even if email configuration is absent. Inspect jobs through trusted operator access only: prefixes contain internal owner/booking identifiers. A job removes batches of up to 100 receipt objects and retries; it keeps rescanning for at least 130 minutes to catch previously issued signed uploads. Storage errors retain the prefix with a generic last_error and exponential delay capped at one hour. A process crash releases through the five-minute lease timeout. After fixing storage credentials/connectivity, run the existing authenticated scheduler or wait for its next invocation; do not expose its bearer token. An empty queue alone is meaningful only after observing a successful cleanup and completion of the grace window.

Before admin deletion the UI warns that payment/refund entries and booking-specific audit history are erased. There is no application undo. Backups and previously delivered emails are outside this workflow; any backup restoration is a separate owner-approved recovery and may restore more data than one reservation. A currently sending email blocks deletion until the lease resolves. Existing signed receipt reads may work until their 60-second expiry or actual file removal.

For rollback, deploy the previous application without dropping the additive migration or cleanup queue; keep the worker running until pending file cleanup completes. Rolling back code cannot restore erased records. No production migration or deployment is implied by local test success.

## Observed migration 004 rollout

On 26 November 2026 the owner explicitly requested deployment. SQL Editor applied the exact checked-in 004 migration transactionally before PR #8 merged. Postchecks confirmed expected grants/RLS and palette rejection with rollback; counts/settings were preserved. Netlify published main 51c4b84, staff controls loaded, and the minute scheduler returned the new cleanup counters with HTTP 200. No manual scheduler call or real guest deletion was used as a test. See TESTING for remaining live-service checks.

## Release migration 005 and payment recovery

This change is prepared on a feature branch, not applied to production. Rehearse 001–005 on isolated staging and preserve a provider backup before release. Existing 004 environments apply only 005. Backfill reconciliation: bookings.paid remains gross; refunded equals refund-entry sums; legacy payment methods remain unspecified; snapshots and balances are preserved. Review the reconciliation without copying guest/payment data into repository evidence.

Coordinate a short staff maintenance window: pause new holds via Payment Settings, stop staff payment review, apply 005, then deploy the matching app through the protected PR and reload staff/guest pages. Migration 005 intentionally closes legacy financial review paths; an old app cannot record those payments after migration. Re-enable holds only after verified configuration and postdeploy checks. Do not mark the migration/deploy complete based on a local build. App rollback alone is insufficient; pause financial operations and forward-fix the database/app together. Do not replay migrations or delete ledger entries to recover.

Verify a fictional isolated GCash deposit plus cash balance, full online arrival payment with staff proof, signed proof viewing/expiry and denied cross-owner access. Reconcile per-method collections and refunds. Finish an arrived fully paid stay; verify refunds reopen payment status while retaining completion history. Existing scheduler handles staff-prefix receipt cleanup after cancelled booking deletion. If upload/save outcome is uncertain, retry the same form/request; if details change after a committed request, reload before creating a new payment. An uploaded unlinked proof is evidence awaiting verification, not recorded income.

Run node scripts/public-audit.mjs for read-only production checks, or pass an explicitly chosen origin. It prints response statuses/timings, asset totals, accessible source-map counts and credential-pattern counts without printing response bodies or token values. Timings are HTTP samples, not Lighthouse or Core Web Vitals. Run npm audit --omit=dev --json for package advisories. Full load testing, security certification and owned sender/SMTP/restore readiness are separate.

## Observed migration 005 rollout

The owner approved the snapshot/pause explicitly after initial automatic review required that approval. A restricted release_backup_005_20261126 schema now stores pre-release bookings, payment_entries, receipts, site_content, offerings, resources and definitions of affected functions. It has no anon/authenticated/service_role schema/table privileges and all copied tables have RLS. Access remains with the database operator. This is a same-instance migration snapshot, not a provider backup or tested disaster recovery. Do not blindly restore it over business records created after release; reconciliation and recovery require a separate reviewed operator action.

New holds were paused in site_content, the checked-in 005 migration was verified against the full SQL-editor contents and applied transactionally, rollback-only financial tests passed, and PR #10 deployed as Published main 327cdc4. Existing payment settings were then saved with the GCash classification and their previous enabled readiness. Postchecks confirmed unchanged website/QR details, ten accommodations/three published and no retained financial fixtures. See TESTING for the observed boundary and outstanding provider tests. The earlier prepared/not-deployed wording above describes the pre-release checkpoint.

## Release migration 006 and booking recovery

1. Rehearse migrations 001–006 and the application in isolated services. Test real Auth redirects (including reset=1 and encoded next), proof transport, independent capacity contention, and separate guest/admin inbox delivery. PGlite and mocked-handler checks do not prove these integrations.
2. Review the PR and green Application/Documentation checks. Arrange a coordinated maintenance window: 006 replaces quote/hold signatures, so the old app cannot create new reservations after it is applied. Do not apply it as an unattended rolling migration. Keep payment/review operations and the outbox paused during the incompatible transition. Any production pause or mutation needs the owner’s authorized release procedure.
3. Before migration, take a verified independent backup and securely capture definitions/grants for booking_quote_base, booking_quote, create_hold_base and create_hold, plus current readiness and scheduler settings. Do not save database contents or secrets in this public repo. A same-database snapshot is not an independent backup.
4. Apply [006](../supabase/migrations/006_booking_experience.sql) once after 005, deploy the matching reviewed application, refresh stale clients, and verify the new function signatures/grants, owner-only personal history, newest-first staff list and private helper denial. Existing bookings must retain their timestamps, totals and ownership. No real booking/payment should be created as a release fixture.
5. Configure the fixed-origin Auth callback query allowlist in [Configuration](CONFIGURATION.md). Restore prior readiness/scheduler settings only after compatible UI/API checks pass. Inspect staff/guest outbox audiences and worker responses; verify actual delivery separately using approved isolated recipients.
6. On failure before migration commit, the SQL transaction rolls back. After commit, prefer a reviewed forward fix. If application rollback is required, keep holds and outbox paused; restore the captured old four function definitions/grants and remove the added 006 trigger bindings/functions in a reviewed recovery transaction before publishing the old app. Preserve bookings, receipts, payment entries and queued jobs; do not reverse timestamps or delete new booking records. The additive email columns/index can remain, but old workers BCC the legacy mailbox and do not understand staff links. Rehearse recovery on isolated services and reconcile pending jobs before restarting old workers.

No production 006 migration, pause, SMTP change or deployment is performed by local implementation. Branded Auth templates await an owned verified domain; existing provider recipient restrictions also apply to admin alerts. Failed outbox jobs remain visible and retryable; presence of environment values is not proof of delivery.

## Observed migration 006 rollout

On 26 November 2026 the owner explicitly approved the same-database snapshot and temporary booking/scheduler pause despite no provider backup. release_backup_006_20261126 preserves bookings, payment entries, receipts, email jobs, settings, audit/promo records, public function definitions/grants and the prior readiness/scheduler state. Copied tables have RLS and schema/table privileges are revoked for PUBLIC/anon/authenticated/service_role. It is not an independent backup and must not overwrite newer business records during recovery.

Direct updates to cron.job are denied in this project. The initial preparation transaction rolled back completely; cron.alter_job(jobid,active:=false) then paused the named worker successfully. The reviewed 006 migration was applied with an additional final revoke retaining the hold pause. The owner’s existing signed-in alternate Chrome profile supplied Netlify access; PR #13 merged to c6a911d and the matching production deploy became Live.

After compatible UI/API checks, authenticated hold/payment/review grants, previous readiness and cron active state were restored. Exact original booking/payment/receipt rows remain unchanged. The fixed-origin callback query pattern was added without removing the previous entries. The resumed scheduler returned HTTP 200 with zero queued work at 16:49 Philippines time. No live test reservation or payment was inserted. See TESTING for the boundary between deployed behavior and unresolved mail, isolated auth/storage/concurrency and recovery acceptance.
