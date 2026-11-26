# Efficient deployment implementation — 26 November 2026

Prepared in [PR #15](https://github.com/florenceWebDev/yvanders-nature-hills/pull/15) on codex/efficient-deployment: [owner/assisted deployment handbook](DEPLOYMENT.md), PR release packets, read-only release check, conservative Netlify documentation-only build skipping, superseded-PR CI cancellation and deployment regressions in Application CI. [ADR 0009](decisions/0009-efficient-deployment.md) records the decision. No new credentials, application API/schema changes, production configuration mutations or merge/deployment are included.

Local verification: deployment regressions (8), application tests (56), documentation regressions (14), production build including TypeScript, syntax/whitespace checks and documentation coverage passed as recorded in [Testing](TESTING.md). The anonymous read-only production check passed 17/17 in 5,329 ms against the existing live app, with zero browser operations. This is not a measured deployment-time or AI-credit saving.

Implementation commit 5eb0363 passed GitHub Application validation on Node 22 and Netlify preview. Documentation remained queued at this checkpoint. Next incomplete task: verify all final-revision PR checks and the documentation-only handoff's hosting skip/cancellation behavior, then release through the routine handbook when requested. Existing production remains on the booking experience release below; sender/SMTP, isolated integration/contention and independent restore acceptance remain outstanding. Earlier sections are dated historical checkpoints, superseded only by later observed evidence.

# Booking experience deployed — 26 November 2026

[PR #13](https://github.com/florenceWebDev/yvanders-nature-hills/pull/13) merged as c6a911d; Netlify shows that commit Live on the production app. Migration 006 is applied. The owner explicitly approved the restricted same-database recovery snapshot and temporary booking/worker pause after the precheck below. Snapshot schema release_backup_006_20261126 has RLS on every copied table and no client/schema access; it is not an independent backup.

Verified: exact booking/payment/receipt rows unchanged from the snapshot (one booking, two payment entries, one receipt); public routes return 200 and anonymous personal/staff APIs return 401; a live selected-09:15 quote spans exactly 48 hours for two days. The authenticated admin’s personal API returns zero bookings while staff New bookings lists the existing reservation, confirming personal isolation with retained staff visibility. Newest-first staff view and the arrival policy render live. Supabase now retains the two existing callbacks plus the fixed-origin /auth/callback?** return pattern.

Booking readiness, hold/payment/review RPC grants and the scheduler were restored. The scheduled worker returned HTTP 200 at 16:49 Philippines time with processed/sent/cleaned/cleanupFailed all zero. No real booking/payment/proof was created as a release test.

Next incomplete tasks: owned verified sender domain, Resend general-recipient and Auth SMTP/inbox acceptance; full browser signup/recovery/draft continuation on isolated services; independent contention and backup/restore rehearsal. Existing sender restrictions mean deploying alerts does not prove every admin receives them. Earlier precheck/implementation sections below are historical and superseded by this rollout.

# Deployment precheck — 26 November 2026

Owner requested deployment of PR #13. Application and Documentation checks are green on ffff686. Restored the Supabase session and ran a read-only SQL precheck: one booking, two payment entries, one receipt, ten offerings, zero pending email jobs; payment readiness and the minute scheduler are enabled, migration 006 is absent. Supabase displays no provider backups. No database pause, snapshot, migration, merge or production deploy has occurred.

Netlify login requests read-only GitHub email access. Automatic approval review rejected that OAuth grant because its recipient/scope were not specifically approved. Await that exact authorization and the decision to use a restricted same-database recovery snapshot/brief booking-worker pause despite no independent backup, then resume coordinated release. Do not treat the snapshot as disaster recovery.

# Booking experience implementation — 26 November 2026

Implemented in [draft PR #13](https://github.com/florenceWebDev/yvanders-nature-hills/pull/13) on codex/booking-alerts-arrival-continuity: owner-only personal history for every account; newest-created staff reservations; guest-selected arrival time with 1–60 whole 24-hour days for all offerings; authentication draft restoration/requote; and explicit per-admin booking/proof/verified-payment alerts. Migration 006 and branded confirmation/recovery HTML are prepared. Existing reservation snapshots are preserved. See [ADR 0008](decisions/0008-booking-continuity-and-alerts.md).

GitHub Application and Documentation checks passed on implementation commit c69ecf7. Local application tests (56), documentation tests (14), production build, TypeScript and documentation inventories passed. Browser observations and validation limits are recorded in [Testing](TESTING.md). Production remains on the previously released code/schema; no live mutation or test booking/payment is included. Next incomplete task: isolated Auth/SMTP/storage/concurrency and recovery acceptance, then a coordinated reviewed 006 release using [Operations](OPERATIONS.md#release-migration-006-and-booking-recovery). An owned verified sending domain is still unavailable.

# Live payment release — 26 November 2026

Deployed through [PR #10](https://github.com/florenceWebDev/yvanders-nature-hills/pull/10): Netlify published main 327cdc4 with migration 005 applied. The owner explicitly approved the restricted same-database snapshot and temporary pause of new holds. Snapshot schema release_backup_005_20261126 has RLS on every copied table and no client/schema access; it is a migration recovery aid, not an independent backup. New holds were restored to their previous enabled setting after deployment.

Verified live: separate Website/Payment settings, successful payment-settings save, existing QR classified as GCash with label/image/recipient/instructions retained, daily reservation payment/balance column, Finished filter and collections-by-method dashboard. SQL checks confirm new grants/private-helper denial, settings preservation and unchanged counts: ten accommodations (three published), zero bookings/payment entries/receipts. Rollback-only SQL checked GCash plus cash, retry idempotency, refund reopening, finish, scoped settings and nonadmin denial without retaining fixtures. Scheduled worker returned HTTP 200 at 12:15 Philippines time. Public route/asset and anonymous endpoint checks passed; see [Testing](TESTING.md).

Next incomplete verification: actual staff file-upload transport and signed-proof expiry on isolated services, independent-connection contention, general guest SMTP/sender and independent backup/restore acceptance. No real booking/payment/proof was added as a deployment test. Earlier pending-release/blocker sections below are historical and superseded by this rollout.

# Live release precheck — 26 November 2026

Owner requested release to live. PR #10 is ready for review (no longer draft), with Application, Documentation and Netlify preview checks green on implementation commit 28ff7e0. Supabase precheck observed ten accommodations, zero bookings, zero payment entries, zero receipts, payment_ready=true and migration 005 absent. This supersedes the older one-booking checkpoint; no existing records were changed.

Supabase reports no provider backup. Proposed a restricted same-database snapshot of affected application tables/function definitions plus a temporary pause of new holds for the coordinated migration/deploy. Automatic approval review rejected that transaction because these additional production mutations and interruption need explicit approval. The transaction was not executed; no snapshot, pause, migration, merge or deployment occurred. Await owner approval for that exact preparation, then apply 005, merge PR #10, verify the published app and restore prior hold readiness. A same-database snapshot is not an independent disaster-recovery backup.

# Payment tracking, settings split and audit — 26 November 2026

Implemented locally on codex/payments-settings-audit: separate Website/Payment Settings, guest choice before QR display, payment-method proof metadata, staff online payment proof uploads, individual payment entries, net balances/refunds, method reporting and separate Finished stay action. Migration 005 is prepared and has not been applied to production. Existing live records/configuration were not mutated during the audit.

Local verification: 48 application tests, 14 documentation tests, production build, TypeScript, documentation inventories and local smoke passed. Production audit found no privileged credential matches in inspected public assets; actual new service upload/concurrency checks remain pending.

Read [ADR 0007](decisions/0007-payment-ledger-and-settings.md), [Audit](AUDIT.md), [Testing](TESTING.md) and the [005 release procedure](OPERATIONS.md#release-migration-005-and-payment-recovery). Next incomplete task: review/merge the feature PR, rehearse on isolated services, then coordinate migration 005 and deployment. Do not use production guest payments as test fixtures. Earlier checkpoints below describe the deployed 004 baseline.


# Appearance and booking management — 26 November 2026

Deployed: administrator button alignment, editable marketing images/logo/gallery/full palette with size guidance, existing contact email, daily overlapping-stays table, owner active-unpaid deletion and admin cancelled permanent deletion including financial entries. [PR #8](https://github.com/florenceWebDev/yvanders-nature-hills/pull/8) merged with passing Application, Documentation and Netlify preview checks. Netlify published main `51c4b84`; migration 004 was applied through SQL Editor before the merge.

Verified on production: enabled appearance editor and image-size guidance in the existing staff session; administrator input/button bottom alignment; Daily list loads without error; public routes HTTP 200; session configured; both deletion endpoints reject anonymous requests with 401. The scheduler returned HTTP 200 with processed/sent/cleaned/cleanupFailed all zero at 09:38 Philippines time. Migration verification confirmed cleanup-table RLS, denied anonymous/client queue/private-helper privileges, expected RPC grants, and rejected invalid palette writes inside a rolled-back transaction.

Owner configuration has changed since the older cleanup checkpoint: ten accommodations exist, three are published, one booking exists and payments are enabled. These records and settings were preserved. No booking deletion or live branding change was performed during deployment verification.

Next incomplete verification: isolated destructive booking flows, real uploaded-logo/image persistence, independent deletion/upload/review contention, daily browser pagination above 100 rows, and actual receipt removal through the signed-upload grace window. General guest email, recovery and restore limits remain separate. See TESTING and ADR 0006. Earlier sections below preserve historical checkpoints.

# Current handoff — 26 November 2026

## System-check removal

Complete on live Supabase: removed the exact fictional listing, its three bookings and dependent receipts/email jobs/payment entries/redemptions, test resource and test files. Verified zero related records remain; all ten real accommodation drafts are intact/unpublished. Public fixture copy and nonpayable QR were cleared and readiness disabled. Accounts are preserved.

## Configurable payment QRs

Deployed through [PR #6](https://github.com/florenceWebDev/yvanders-nature-hills/pull/6) at main `11e37b5`: up to three ordered admin payment options with individual labels/images/recipients/instructions, add/edit/remove/reorder, responsive guest cards and legacy snapshot reads. Migration 003 enforces array rules in trusted database functions and preserves old snapshots. Application tests/build passed; see TESTING for final evidence. Live migration 003 was applied through the approved Supabase dashboard session and verified: valid empty options, payment readiness false, anonymous writes denied, private helper access denied, and ten drafts intact. [PR #6](https://github.com/florenceWebDev/yvanders-nature-hills/pull/6) passed Application, Documentation and Netlify preview checks on its implementation commit. PR #6 was merged after the owner explicitly approved merge/deployment; Netlify reports Published for main `11e37b5`. Live admin assets contain the new editor, `/api/session` reports configured, and the deleted fixture URL returns 404. The owner will configure real QRs later in admin and enable payment holds after saving a complete option. Real drafts stay unpublished until owner configuration. No payment details were invented.

The following sections preserve previous milestone history. Their fixture instructions were superseded by the cleanup above.

# Implementation handoff — 25 November 2026

## Current connected-service milestone

The owner selected Netlify hosting and a permanent Supabase project, deferring domain purchase. The public site is https://yvanders-nature-hills.netlify.app/. A production redeploy of main `b9b3521` loaded the configured services; `/api/session` returns `configured: true`. Both checked-in migrations were applied in order through SQL Editor. All twelve public tables have RLS; receipts are private, marketing images public. The verified owner has staff access. Ten actual accommodation drafts remain unpublished. The only published listing is the explicitly approved fictional `system-check-do-not-pay`, with a nonpayable image and prominent instructions.

Netlify contains the public URL/publishable key and protected server, sending-only Resend and scheduler keys. Nonproduction deployments do not receive working server/email credentials. Supabase Vault stores the scheduler token; `ynh-email-outbox` runs every minute through pg_cron/pg_net. Observed scheduled responses are HTTP 200 with an empty queue. No domain or paid plan was purchased. [ADR 0004](decisions/0004-connected-netlify-services.md) supersedes the preview-only constraint of ADR 0003.

Verified: browser quote/hold; signed fictional proof upload/download and review through deployed APIs; persistence after browser reload; direct nonadmin ownership/storage/write denials; exactly one winner from two independent requests; owner inbox acknowledgment and confirmation. The fictional confirmation includes a clearly labeled fictional deposit, and the race hold is expired. No money was sent. A synthetic nonadmin account is banned after checks. Browser automated file selection remains blocked by extension permission; manual selection needs owner verification.

Next: owner may repeat the labeled booking check, then supply verified business rates/capacities/contact/payment instructions before replacing the fixture. Current `payment_ready` is enabled solely for this explicit nonpayable check; turn it off, unpublish the fixture, and exclude its fictional bookings/payment ledger from real reports before launch. Preserve real records and use a reviewed cleanup migration if fixture removal is desired. General guest email needs an owned verified sender and suitable Auth SMTP; defaults restrict recipients. Restore, prolonged performance and remaining failure-path checks are incomplete. See [Testing](TESTING.md#connected-services--25-november-2026).

The sections below preserve earlier milestone history; their pending-provider statements describe those earlier checkpoints.

## Temporary Netlify client preview

Owner selected their own Netlify account and the existing draft/demo mode. Node 22 build configuration and the deployment/rollback runbook are prepared on `codex/netlify-client-preview`. Git connection, publication, public URL and hosted verification remain pending. Keep application service credentials unset and payments disabled. Final custom domain and permanent hosting remain a separate decision; no purchase or DNS change is included. See [ADR 0003](decisions/0003-temporary-netlify-preview.md) and [Operations](OPERATIONS.md#temporary-netlify-client-review).

## Implemented
Milestone 0: starter pack, all 15 images, reference and environment inspected; agreed planning docs saved before code scaffold.
Milestones 1–2: public marketing/listings/detail/gallery/info pages; guest auth and history; server-generated 30-minute holds; original private receipt uploads; protected booking/content/inventory admin; configurable deposits, schedules and capacity pools; manual bookings/blackouts; audit trail and email outbox with retries.

## Verified locally
Production build and TypeScript pass. 13 automated validation/PostgreSQL tests pass. All 12 public/account/admin route HTTP checks and protected-endpoint smoke checks pass. Browser inspected desktop homepage, accommodation filter/navigation, mobile detail/admin layouts; narrow-mobile hero overlap corrected.

## Integration and release gate
Live Supabase Auth/Storage and independent concurrent database connections are not configured or verified. Real Resend delivery and Vercel publication are blocked on owner accounts/configuration. No production site has been published and no real reservation/payment has been accepted. Public preview explicitly uses drafts; staff preview has no guest records and does not save.

## Next concrete task
Owner configures Supabase/Resend/Vercel and required env values using README. Apply migration, register/verify/promote staff, optionally seed unpublished drafts, verify QR/rates/photos/capacities/schedules/contact/policies, then execute the staging acceptance matrix. Keep payments disabled until these checks pass.

## Deferred
Payment gateway, automated refunds, SMS, booking-channel synchronization, multi-offering cart.

## Local setup and GitHub handoff — 25 November 2026

- Selected scope: working local preview first; live booking-service setup remains separate.
- Local dependencies are installed; `npm run dev` starts at http://127.0.0.1:3000. README now contains exact PowerShell commands, page links, shutdown, port-conflict handling, and fresh-clone instructions.
- Local route and protected-endpoint smoke checks passed again. Homepage rendered in the in-app browser. The preview has no live booking-service credentials.
- GitHub connector account: `florenceWebDev`. Chosen destination: new **public** repository `florenceWebDev/yvanders-nature-hills`, with no generated README or license.
- GitHub website authentication completed. Created the public repository at https://github.com/florenceWebDev/yvanders-nature-hills, configured its HTTPS URL as `origin`, and successfully pushed `main` with upstream tracking.
- Tracked-path and common credential-pattern audits passed before publication preparation. `.env.local`, dependencies, generated builds, and private-key file types are not tracked. Public source includes the supplied campsite photos and documentation as selected by the owner.
- Project moved at the user's request to `C:\Users\USER\Documents\FG\Projects\yvanders-nature-hills`, including installed dependencies and Git history. Restarted the preview there on http://127.0.0.1:3000. README startup commands use the new location. Local route checks passed after the move. Git Credential Manager successfully authenticated the push.

- Current handoff: local preview and GitHub setup complete. Next product milestone remains owner configuration of Supabase/Resend and staged live-booking acceptance. GitHub source publication is separate from website hosting; the website is not publicly deployed.

## Developer handbook and update enforcement

Complete: expanded handbook, API/database/configuration/operations references, contribution and agent rules, changelog/decision records, and documentation enforcement. All 14 checker tests and inventory/link checks passed locally and on GitHub Node 22. The active main ruleset requires PRs and the GitHub Actions Documentation check, with zero independent approvals and no bypass. [PR #1](https://github.com/florenceWebDev/yvanders-nature-hills/pull/1) passed and merged under the rule; [verification PR #2](https://github.com/florenceWebDev/yvanders-nature-hills/pull/2) failed for missing documentation, displayed a required failed check and disabled merge button, and was closed without merging. Fresh-clone installation, production build, development startup, and preview HTTP checks passed. See TESTING for evidence and limits. Future changes must update their references in the same PR; humans still verify semantic accuracy. Next product work remains staged live-service setup.

## Administration expansion and full website audit

Implemented: persistent active header/mobile/admin navigation, homepage readability and tablet layout fixes; individual page titles; equal administrator management for verified accounts; period performance dashboard with payments/refunds/opening balances; full promo controls including staff-approved complimentary reservations; range-paginated month/week/mobile agenda calendar and shared reservation review. Migration 002 is required after 001. Architecture decision 0002 records the model. No additional runtime dependency or production deployment was added.

Local validation and limitations are in TESTING and AUDIT. Work proceeds through the protected feature PR, with documentation and Node 22 application validation. Next operational milestone remains staged provider configuration, applying migrations and executing real account/payment/email/concurrency acceptance. Do not enable live bookings merely because preview/build/tests pass.

[Feature PR #4](https://github.com/florenceWebDev/yvanders-nature-hills/pull/4) passed its initial Node 22 application and required documentation checks. Merge only when both checks remain green on the latest commit; all provider/staging release gates remain separate.
