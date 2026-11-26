# Homepage mobile booking search — 26 November 2026

- Pass: configuration-free local browser inspection at 320px, 390px, a 650px innerWidth readout with max-width:650px active, and 1280px desktop. Mobile has dates in row one, time/guests in row two and the button across row three; paired controls align even when Arrival Time wraps at 320px. No observed form or document horizontal overflow after the sizing fix. Selected dates remained fully readable at the narrow width.
- Pass: original defaults 14:00 and 2 guests, required date/time controls and accessible names are preserved. At each tested width, selecting 1–3 May 2027, 09:15 and 4 guests navigated to /stays with arrival=2027-05-01, departure=2027-05-03, arrival_time=09:15 and guests=4. Desktop retains four fields and its action in one row. This checks search navigation; no quote, booking or provider write was performed.
- Browser boundary note: Windows/IAB scaling rounds the requested 650px viewport slightly above the CSS media boundary (max-width:650px was false). The adjacent 649px override reported innerWidth=650 with that media query true and verified the mobile layout; the above-boundary sample retained the existing tablet layout. The CSS breakpoint remains exactly 650px. This is Chrome/IAB rendering, not a physical-device Safari matrix.
- Pass: npm run build (production compilation and TypeScript), npm run docs:test (14 tests), npm run docs:check (links, API/environment inventories and change impact), and git diff --check. A separate comparison against audit-hardening verifies this change has only six affected files. No new unit tests were added for this reversible label/CSS adjustment; rendered geometry and real form navigation were checked instead.

# Website audit hardening — 26 November 2026 (local implementation)

- Pass: application suite grew from 56 to 72 tests. New coverage exercises migration 007, the reproduced disjoint-reservation false-sold-out case and real peak rejection, shared pools/blackouts/expiry, three unresolved reservations, ten rolling-hour creations, identical retries, deletion-resistant history, manual exemptions, private table/function permissions and revoked direct quote calls.
- Pass: the grouped report matches the prior report across 601 fictional bookings, method-specific receipts/refunds/opening balances and Philippines midnight boundaries. Guest HTTP history reaches all 606 owner rows across 13 pages without cross-owner leakage. These are isolated fixtures, not production records or production query plans.
- Pass: session-read regression confirms 429/503 failures propagate to visible errors instead of masquerading as setup/signed-out state; account loads offer retry.
- Pass: HTTP/security regressions cover streamed JSON overflow with forged Content-Length, unavailable counters, HMAC-scoped identifiers, trusted-ingress requirement and IPv6 normalization, rejection of forwarded-header identity, Retry-After responses before record access, private unexpected errors, one batch availability RPC and rejection of forged actor fields.
- Pass: worker tests cover distinct staff/guest links, provider acceptance versus failure, numeric/date retry headers, provider quota cooldown, releasing unsent leases without spending an attempt, rotating claim tokens and expired final-attempt recovery. Production CSP tests verify fresh nonce policies, private HTML and no unsafe-eval.
- Pass: npm run build including TypeScript; npm run typecheck; eight deployment regressions and fourteen documentation regressions; npm run docs:check; git diff --check and node --check scripts/smoke.mjs. Node 23.2.0 emits existing experimental module warnings; Node 22 CI remains a separate check. The new database fixture explicitly awaits PGlite initialization before test hooks after an intermediate setup timeout; no timed-out run is counted as a pass.
- Pass: configuration-free local preview on 127.0.0.1:3003: twelve public/account/admin/detail routes, session, cron denial, foreign-origin rejection, unconfigured read/write failures (503), and missing-page 404 via scripts/smoke.mjs. Direct HTTP inspection found a nonce script policy with strict-dynamic, 21 script tags/23 nonce attributes and no-store HTML. No nonce values or credentials were logged.
- Pass: browser inspection of the existing design at 1280px and 390x844, responsive optimized hero/detail images, locally served heading typography, no observed overflow/broken loaded homepage images, hydrated staff preview, and navigation through all eight admin sections. New email/activity pagination controls render in the empty preview. This is not authenticated Supabase pagination/upload acceptance or a full accessibility/browser-engine matrix.
- Pass: final configuration-free production build and strict-CSP browser hydration (staff preview and lazy Email & activity section); no browser console errors were observed. Two production-preview responses had distinct nonces and all 13 script tags matched their response policy, with private/no-store HTML and no unsafe-eval. Production-preview smoke passed all route/permission/unconfigured-state checks again. npm audit --omit=dev --json reported zero known production vulnerabilities; 26 built client text assets had zero exact matches for locally configured privileged values. These artifact checks are scoped evidence, not proof of every possible secret or integration.
- Pass: [draft PR #16](https://github.com/florenceWebDev/yvanders-nature-hills/pull/16), implementation a8b2cd5, passed [Application validation on Node 22](https://github.com/florenceWebDev/yvanders-nature-hills/actions/runs/45833135038) and [Documentation](https://github.com/florenceWebDev/yvanders-nature-hills/actions/runs/45833134939). Netlify marked its deploy preview successful. The preview redirects to Netlify Team protection (invited-account sign-in), so no hosted rendered/CSP acceptance is claimed from that build status. This checkpoint changes documentation only; final-revision checks remain a release requirement.
- Resolved environment blocker: the first sandbox preview timed out; automatic approval review could not initially launch an unsandboxed preview due to an account usage limit (not a safety decision). After its reported reset time, the authorized retry worked and the browser/smoke checks above passed.
- Blocked/Not run: independent PostgreSQL connection races and production-scale EXPLAIN plans (no local PostgreSQL/psql/Docker or isolated provider database supplied); hosted ingress-header spoof resistance, cache TTL/save invalidation on connected services, nonce CSP with the Netlify-injected badge, authenticated signed uploads/guest/staff workflows, general recipient email/SMTP, independent backup/restore, and production migration/deployment. No real booking/payment/receipt was created or modified. Earlier production audit samples validate the previous application only; no before/after Core Web Vitals or load-test improvement is claimed.

# Deployment tooling verification — 26 November 2026

- Pass: `npm run deployment:test` — eight regressions covering anonymous GET-only success/CLI exit zero; protected 200 failures and body redaction; unconfigured/malformed sessions; invalid/preview HTML, redirects and soft 404s; disconnected sockets, header/body timeouts; safe origin handling; recognized docs versus runtime/assets/SQL/unknown paths; real Git docs/mixed/rename/deletion/nonancestor/missing-history comparisons; and actual Netlify skip/build exit semantics. Local HTTP/Git fixtures do not establish hosted Netlify behavior. An initial missing fixture directory was corrected before the passing rerun.
- Pass: `npm test` — 56 application/database/handler tests; `npm run docs:test` — 14 documentation regressions; `npm run build` including TypeScript; `node --check` for both deployment scripts and their test module; `git diff --check`. Local runtime is Node 23.2.0 and emitted experimental module warnings; Node 22 hosting/CI results must be verified on the PR.
- Pass: `npm run docs:check` after updating the testing reference; local links, API/environment inventories and change-impact coverage. The initial intermediate invocation correctly failed because this testing reference had not yet been updated.
- Pass: the new `npm run release:check` against existing production returned 17/17 in 5,329 ms: eleven branded HTML pages, configured session, four anonymous protected-route denials and missing page 404. The sandbox's earlier HTTP attempt lacked network access; the authorized network-enabled read-only run succeeded. This checks the existing live app, not publication of this branch. No sessions, response bodies, credentials, booking/payment/proof changes or browser operations were used.
- Pass: [PR #15](https://github.com/florenceWebDev/yvanders-nature-hills/pull/15) implementation commit 5eb0363 passed [Application validation on Node 22](https://github.com/florenceWebDev/yvanders-nature-hills/actions/runs/45789608559), including all deployment regressions and build. Run creation to completed update was 39 seconds; this includes scheduling and is not isolated build time. Netlify reported Deploy Preview ready for that revision. GitHub parsed both workflow definitions; Documentation was still queued at this evidence checkpoint. Any later documentation revision needs its own final check status.
- Reviewed: workflow expressions preserve existing triggers, names and permissions, use PR-number concurrency for cancellation, and unique run IDs for main/manual runs. No application rendered layout changed; browser UI checks were not applicable to this tooling change.
- Not run: production merge/deployment, database/configuration mutations, hosted documentation-only skip and actual superseded-run cancellation. These need subsequent hosted evidence; do not infer them from local Git fixtures. Independent backup/restore, SMTP/general inbox, isolated authenticated storage and contention limitations below are unchanged. AI billing and total release-time savings are unmeasured; 5,329 ms is one HTTP sample.

# Booking experience production rollout — 26 November 2026

- Pass: owner explicitly approved the restricted snapshot and brief pause. Created release_backup_006_20261126 with affected application records, function definitions/grants and previous readiness/scheduler state. Every copied table has RLS; client schema access is denied. This is a same-instance recovery aid, not independently verified disaster recovery.
- Pass: initial direct cron.job update was denied; the transaction rolled back fully (snapshot absent, readiness/scheduler still true). Retried with permitted cron.alter_job and confirmed snapshot/pause succeeded. Hold, payment and review RPC access was paused during transition.
- Pass: loaded the exact migration from reviewed commit ffff686, compared the complete selected editor contents with that source plus a final hold-grant pause, and applied transactionally. Existing booking, two payment entries and receipt compare exactly with the snapshot. New migration columns exist; private queue helper denies client execution and public quote remains granted.
- Pass: PR #13 Application/Documentation checks green, PR merged as c6a911d, Netlify shows matching production commit Live. Used the already signed-in alternate Chrome hosting profile.
- Pass: deployed /, /stays, /account, /admin and /api/session returned 200. Anonymous /api/bookings and /api/admin/bookings?order=newest returned 401. A production quote returned 200 with arrival/departure at 09:15 Philippines and exactly 48 hours across two days, with schedule_policy=arrival_24h. This read-only quote creates no hold.
- Pass: authenticated staff Reservations defaults to New bookings · latest first and loads one reservation. The same admin’s personal /api/bookings returns zero rows; no other owner’s reservation appears there. No record details or session identifiers are copied into this evidence.
- Pass: visible deployed arrival/time controls and late-arrival policy; saved fixed-origin callback query pattern alongside the two existing redirect URLs. This verifies configuration, not an actual verification/reset email round trip.
- Pass: restored previous readiness/scheduler settings and authenticated hold/payment/review grants; counts remain one booking, two payment entries, one receipt. Scheduler HTTP 200 at 16:49 Philippines time, timed_out=false and processed/sent/cleaned/cleanupFailed=0.
- Blocked/Not run: general guest/admin inbox delivery and branded Auth sender (owned verified domain/SMTP unavailable), full isolated browser auth-draft round trip, independent-connection contention and independent backup/restore. No live booking/payment/proof was created or deleted as a deployment fixture.

Earlier checkpoints below are historical and superseded where this rollout supplies newer evidence.

# Deployment precheck — 26 November 2026

- Pass: PR #13 mergeable; GitHub Application and Documentation checks successful on ffff686.
- Pass: read-only Supabase precheck found one booking, two payment entries, one receipt, ten offerings, no pending email jobs, readiness/scheduler enabled and migration 006 absent. No guest details or signed URLs copied into evidence.
- Blocked: Netlify OAuth email-read grant rejected by automatic approval review pending explicit authorization. Supabase reports no provider backups; independent backup/restore is unverified.
- Not run: snapshot/pause, migration 006, merge and deployment. Production remains unchanged.

# Booking experience checks — 26 November 2026

- Pass: migration 006 applied locally after 001–005 in PGlite; existing booking timestamps/snapshots preserved. Every offering uses selected whole-minute arrival time and 24-hour days with correct price bases; missing/invalid time, duration, overlap boundaries, blackouts and Finished allocations checked.
- Pass: new-booking fan-out to two verified admins, manual/complimentary final status/totals, proof versus verified-payment alerts, balance alerts, current admin membership, retry deduplication and private helper denial.
- Pass: actual HTTP handler code executed against isolated adapters: two admins and a guest see only their own personal records, forged owner query ignored, shared newest-first staff listing retained, guest/anonymous staff access denied. Signup/recovery callback returns, expired links, unsafe redirects and worker failure/retry/BCC removal checked. Provider adapters are mocked; no live delivery is inferred.
- Pass: versioned draft expiry, retained selection and unsafe-return validation. Full browser login/verification/draft restoration remains Not run against isolated services.
- Pass: Chrome desktop homepage and accommodation detail; selected 09:15 time/date values and late-arrival note visible. At 390×844 mobile, booking panel overflow found and corrected; recheck showed content width within viewport and readable form/native required-field validation. Mobile listing arrival controls inspected and intrinsic input widths corrected/rechecked; small-screen search now stacks fields for full native date readability.
- Blocked: rendered authenticated staff table/review and two-account browser history verification; local browser has no staff session. Handler and SQL tests cover the boundaries, not authenticated browser behavior.
- Blocked: real SMTP/inbox delivery and unrestricted guest/admin recipients; owned sender domain unavailable.
- Not run: production migration/deployment, real payment/proof creation, independent-connection contention and isolated recovery rehearsal. Local rendering reads published catalog only; no live booking/payment was created.

- Pass: GitHub Application and Documentation workflows on implementation commit c69ecf7 in [PR #13](https://github.com/florenceWebDev/yvanders-nature-hills/pull/13). The PR remains draft for coordinated release and pending isolated integration acceptance.

Final local commands: Pass — npm test (56 tests), npm run docs:test (14 tests), npm run build, npm run typecheck and npm run docs:check. The initial build exposed a tuple inference error in the new test fixture; it was fixed and the affected checks rerun successfully. Earlier sections retain historical release evidence.

# Production payment rollout — 26 November 2026

- Pass: owner approved the restricted snapshot and temporary hold pause. Created release_backup_005_20261126 copies of affected application tables and function definitions, with table RLS and revoked schema/table access for anon/authenticated/service_role. Verified authenticated schema access=false and all copied tables RLS=true. This is not an independent provider backup.
- Pass: exact migration 005 contents were compared against the full SQL editor selection before execution. Migration completed successfully. Verified method/refund/completion fields, authenticated payment RPC grant, anonymous payment denial and client denial of private legacy review/proof helpers.
- Pass: rollback-only production SQL checked two-method payment recording, exact retry deduplication, proof linkage metadata, finish, refund reopening, section-save isolation and nonadmin denial. The transaction rolled back; bookings, ledger entries and receipts remained zero. No actual storage bytes or transfers were involved, so this does not establish real upload transport.
- Pass: PR #10 latest head 2eb74e4 had successful Application/Documentation/Netlify preview checks, merged as 327cdc4. Netlify explicitly reports Published for that production commit (29-second deploy).
- Pass: existing live staff session loads separate Website Settings and Payment Settings. Payment settings save persisted the existing QR option's GCash method and restored prior payment_ready=true; QR label/image/recipient/instructions and all website settings match the pre-release snapshot. No destination/payment account changed.
- Pass: live daily reservation table loads its Payment / balance column and Finished filter; dashboard loads Collections by payment method with the correct empty state. Final counts: accommodations=10, published=3, bookings=0, payment_entries=0, receipts=0. Earlier one-booking evidence reflects an older owner state.
- Pass: latest scheduled worker response is HTTP 200 at 12:15 Philippines time. No manual scheduler trigger or test mail was sent.
- Pass: public audit after deployment returns 200 for 11 public/account/admin pages and session, 401 for protected booking/admin reads and all four new unauthenticated admin writes. API responses are private/no-store; limited CSP is present. Fourteen client assets (784,379 decoded bytes across routes) yielded zero privileged credential-pattern matches and no successful probed JSON source maps. No credential values or real payment/guest data were logged.
- Pass: live 828px optimized hero returns HTTP 200 as image/webp, 122,788 bytes versus the 833,933-byte original. Release-evidence docs:test (14) and docs:check pass.
- Not run: actual staff receipt upload/storage read-link expiry, independent-connection financial/settings/deletion contention and postrelease general guest email. Owned sender/Auth SMTP and independent backup/restore limits remain open as previously documented. No new release claims replace those limits.

Earlier pending-release sections below are historical and superseded where the rollout above provides evidence.

# Individual payments, settings and audit — 26 November 2026

## Application and database checks

- Pass: npm test, 48 tests. Administration tests apply migrations 001–005, preserve legacy entries and exercise GCash deposit/cash balance, staff online full payment with linked proof, identical/changed retries, wrong-booking proof rejection, guest authorization, refund reopening, finished history/reporting/capacity, scoped settings merges and prepared-upload deletion cleanup. Baseline database tests intentionally retain 001–002 coverage; storage-worker and signed-upload transport tests use mocks.
- Pass: browser fixture inspection in Chrome desktop and 390×844. Zero QR cards before selection, one correct card after choosing GCash or bank. Separate Website/Payment forms and save actions; online proof controls appear, cash needs none; partial balance prevents completion. Failed payment save shows configured-service error and re-enables retry. No horizontal overflow in the inspected guest/settings mobile states. Temporary fixture had fictional data, no live service access, and was removed.
- Pass: optimized homepage hero loaded with responsive srcset; desktop composition retained. Production build/typecheck and final smoke results are recorded in the final checkpoint below.
- Pass: npm run docs:test, 14 checker tests. Final docs:check passed after references were completed.

## Security check

- Pass: read-only production pages/assets and anonymous protected-read checks summarized in [Audit](AUDIT.md). No privileged credential pattern matches in the inspected public responses, no successfully probed JSON source maps, and no known production dependency vulnerabilities from npm audit --omit=dev --json.
- Pass: isolated SQL guest denial of record_payment/finish/settings, denied service-only proof RPC access and no cross-owner receipt metadata. Actual new RPCs have not been installed in production.

## Performance check

- Pass: production HTTP baseline collected; request-scoped catalog reuse and responsive bundled image fixes implemented. This is not a measured production Core Web Vitals improvement. Postdeploy comparison, throttled browser metrics and prolonged load testing: Not run.

## Remaining service/release acceptance

- Not run: production migration 005 or deployment; existing guest financial records/configuration were preserved.
- Not run: real staff upload, actual private proof URL expiry, independent concurrent payment/refund/settings/deletion connections, and new confirmation email delivery on isolated live providers. PGlite serializes statements and mocked transport does not establish these outcomes.
- Blocked for general release as previously documented: owned verified sender/Auth SMTP and backup/restore acceptance remain outstanding. No claim of security certification or complete accessibility conformance.


# Production appearance/deletion rollout — 26 November 2026

- Pass: [PR #8](https://github.com/florenceWebDev/yvanders-nature-hills/pull/8) merged with passing Application, Documentation and Netlify preview checks. Netlify published main `51c4b84`; migration 004 was applied through SQL Editor before the merge.
- Pass: pre/post schema checks preserve ten accommodations, three published accommodations, one booking, and enabled payments. No existing guest/financial records were deleted.
- Pass: cleanup RLS and grants verified in production; anonymous DELETE RPC access and client queue/private-helper privileges are denied. Expected authenticated wrapper/service-worker grants exist. Invalid palette update was rejected inside a transaction that was rolled back.
- Pass: existing staff session displays enabled appearance controls and recommended dimensions; administrator input/button bottom positions align; Daily list finishes loading successfully. Public home/admin/account/stays/gallery/contact return HTTP 200, /api/session reports configured, and anonymous POSTs to both deletion endpoints return 401.
- Pass: the existing scheduler received HTTP 200 at 09:38 Philippines time with processed=0, sent=0, cleaned=0, cleanupFailed=0. This verifies worker availability with an empty queue, not real receipt removal.
- Not run during production deployment: real booking deletion, live appearance replacement/upload/save, full signed-upload cleanup grace window, independent deletion/payment/review contention, >100-row daily browser pagination, backup restore and additional browser engines. Existing local/mocked tests remain separate evidence.

The following local milestone notes describe the predeployment checkpoint and are superseded by the observed rollout above where applicable.

# Appearance and permanent deletion — 26 November 2026

- Pass: npm test, 38 tests. PGlite executes migrations 001–004, validates appearance writes and private helpers, owner/nonowner/anonymous deletion, ineligible states, financial/dependency erasure, capacity reuse and active email leases. Storage-worker tests use mocks for delayed uploads, cleanup completion and failed-storage retry; these are not real Supabase storage tests.
- Pass: npm run build (final production build, including TypeScript) and npm run typecheck.
- Pass: npm run docs:test, 14 tests; npm run docs:check, including changed-path impacts, local links and API/environment inventories.
- Pass: local configuration-free HTTP smoke routes, session, scheduler credential rejection, same-origin denial and protected APIs. Local preview explicitly overrides Supabase URL/key so it cannot read or mutate live guest records.
- Pass: Chrome desktop at its normal viewport and responsive 390×844 inspection of administrator alignment/stacking, daily table empty state, next-day navigation, existing month view, appearance editor/image previews and contrast feedback. Measured mobile page width remains within the viewport. Header color regression observed during inspection was fixed and rechecked.
- Blocked for this local milestone: live migration 004, real upload/save/reload with a staff session, logo replacement persistence in the deployed header/footer, real guest/admin destructive flows, independent PostgreSQL deletion/upload/review contention, more-than-100-row daily browser pagination, and actual receipt cleanup through the signed-upload grace window. These require isolated staging; production was not altered.
- Not run: failure-path browser checks across multiple browser engines, restore from backup and production deployment. Do not interpret preview UI or PGlite serialization as proof of live concurrency or storage permissions.

# Verification update — 26 November 2026

## System-check removal

- **Pass:** guarded preflight identified the exact approved fixture, three fictional bookings with matching payment snapshots, and one receipt file. Apply removed the listing, bookings and related receipts/email jobs/payment entries/redemptions, test-only resource and storage objects. Service queries verified zero remaining dependent rows, ten real accommodation drafts intact/unpublished, readiness false, test QR empty, and zero marketing files under the fixture prefix. The public Netlify homepage reloaded with normal copy and the unpublished-listings empty state. No account deletion or real accommodation publication occurred.
- **Pass:** cleanup uses count-only logs and an ignored private manifest for interrupted-run recovery. It is a sequence of scoped requests, not a database transaction.

## Configurable payment QRs

- **Pass:** `npm.cmd test` — 28 application/PostgreSQL tests, including zero through three options, four/incomplete/duplicate/unsafe rejection, direct nonadmin save denial, database readiness enforcement and unchanged booking snapshots. Migration 003 executes against the existing migration sequence; explicit legacy QR conversion assertions passed.
- **Pass:** `npm.cmd run build` — production build and TypeScript passed.
- **Pass:** browser component harness used the actual editor/guest components with a clearly fictional local image. Counts 1, 2 and 3 fit at widths 1280, 768, 375 and 320 without horizontal overflow. Desktop columns share width; mobile stacks; all complete images use contain. Screenshots inspected at desktop and 320px. Add-limit, remove, reorder, label/recipient editing, and harness save/load worked. Harness save/load was local simulation, not live persistence. Temporary harness route/image were removed before delivery.
- **Pass:** local connected `/admin` denies an unsigned session.
- **Blocked:** browser file selection: Chrome extension requires Allow access to file URLs. No extension permission was changed; upload/replace and transport failure browser checks remain unverified.
- **Pass:** after owner-approved sign-in, applied the exact migration 003 from reviewed commit `83c0d17` through Supabase SQL Editor; execution returned Success. Live queries verified migration helper present, zero valid options, readiness false, anonymous save_content execution denied, authenticated helper execution denied, and ten real drafts intact. No test booking or payment option was committed.
- **Pass:** [PR #6](https://github.com/florenceWebDev/yvanders-nature-hills/pull/6) implementation commit passed GitHub Application and Documentation workflows and Netlify deploy preview.
- **Not run:** authenticated live multi-QR save/reload with real payment details. The owner elected to configure them later through admin; readiness requires at least one complete option.
- **Pass:** latest PR #6 commit `4d39f09` passed GitHub Application and Documentation workflows and Netlify preview. The owner explicitly approved merge/deployment; merged main `11e37b5` is Published in Netlify production (deploy `6b076628b359eacafbfffb7c`). Hosted `/admin` returns 200; its served JavaScript contains the new QR editor/add control; `/api/session` reports configured; `/stays/system-check-do-not-pay` returns 404. Unsigned browser access still receives the staff-only gate. Full authenticated real-option upload/save remains unverified as stated above. `npm.cmd run docs:test` passed all 14 documentation-checker tests; `npm.cmd run docs:check` passed local links, endpoint/environment inventories and change-impact coverage.

The sections below preserve prior testing history; historical statements that the fixture is still published are superseded above.

# Verification evidence — 25 November 2026

## Connected services — 25 November 2026

- **Pass:** public Netlify production redeploy; live `/api/session` returns HTTP 200 and `configured: true`. Existing permanent Supabase project is used. Exact migrations 001/002 applied through SQL Editor; twelve public tables have RLS; receipts bucket private, marketing public. Seed created ten unpublished accommodation drafts.
- **Pass:** owner completed registration and email verification; exact confirmed account bootstrapped as first administrator. Browser staff page shows membership and last-admin removal disabled. This is actual public signup evidence; supplemental API tests use temporary in-memory sessions.
- **Pass:** owner explicitly approved a labeled fictional listing, nonpayable instruction image and fictional proof. Only `system-check-do-not-pay` is published. Public content and instructions say do not pay; no actual accommodation or payment account is published. Displayed PHP 100 price/PHP 50 deposit are fictional. No money moved.
- **Pass:** actual browser quote and hold; account navigation persists hold. Direct live HTTP APIs issue signed upload, accept the original fictional PNG, persist pending review and a private receipt, issue a working short-lived download and persist staff confirmation. Zero-paid confirmation was correctly rejected; confirmation with the explicitly fictional deposit passed. Reloaded browser shows confirmed status, fictional staff note and receipt link.
- **Pass:** separate nonadmin synthetic Auth account cannot read the owner's booking/receipt, list administrators or directly update booking rows. Anonymous private storage download denied. Two independent authenticated Supabase clients simultaneously compete for one unit: exactly one hold succeeds. The resulting synthetic hold was marked expired and its synthetic account banned after checks; no guest email was sent for that hold. These labeled records remain in the permanent database, including the fictional confirmation/payment ledger, and must be excluded from real operating totals before launch.
- **Pass:** Vault-backed minute pg_cron/pg_net calls returned HTTP 200 and an empty queue after redeploy. Both subsequent owner-only proof/confirmation email jobs reached `sent`, one attempt each, no errors. Gmail inbox visibly contains both acknowledgment and confirmation for the fictional booking. This proves owner-mailbox delivery with the default sender, not arbitrary guest delivery.
- **Pass, limited:** narrow rendered account layout inspected after reload, including confirmed/expired records and explicit fictional notes. No layout code changed. No Safari/Firefox or physical-device checks were run.
- **Pass:** final hosted GET checks: home, stays, fictional detail, account and admin shell returned 200; anonymous `/api/admin` and `/api/jobs` returned 401. Single sequential observations from this workstation ranged about 0.57–1.77 seconds for page responses. These are basic reachability observations, not a sustained performance benchmark or browser load metric.
- **Blocked for browser automation:** Brave extension file chooser needs file-URL access. Native chooser was attempted but did not attach a file; no extension security setting was changed. Signed upload/download and completion were instead verified directly against deployed APIs. Manual browser file selection still needs an owner check.
- **Not run:** password reset, expired-session behavior, guest-to-guest signed-upload abuse, network interruption/retry transport, full batch function-duration load, prolonged availability/performance and backup restoration. Default Supabase Auth SMTP and Resend sender restrict recipients. Domain and custom Auth SMTP remain deferred.

Automatic approval review rejected a manual `/api/jobs` probe because it could send pending mail. That probe was not executed; read-only queue checks and observed scheduled HTTP results supplied verification. Booking notifications above came from the owner-approved fictional workflow and the installed scheduler. No credentials, session material or signed URLs are included in evidence.

### Current verification commands

**Pass:** `npm run docs:test` (14 tests) and `npm run docs:check` (links, inventories and 13 changed paths). No application source or schema definition changed during this configuration milestone, so the existing application suite/build evidence is not relabeled as a fresh run. Provider probes/fixtures are ignored local operator files, not a reusable production acceptance suite. Earlier blocked-provider entries below describe historical checkpoints and are superseded only for the specific checks above.

## Temporary Netlify setup — 25 November 2026

- **Pass:** `npm run docs:test` (14 tests), `npm run docs:check`, `npm test` (26 tests), and `npm run build` including TypeScript on local Node 23.2.0. Netlify configuration selects Node 22; hosted adapter execution is not established by this local build.
- **Pass:** production server on port 3003 and `SMOKE_URL=http://127.0.0.1:3003 node scripts/smoke.mjs` (environment assigned through PowerShell): twelve page routes, session, unauthorized jobs, foreign-origin mutation, unconfigured-service read/write denial and 404. Initial sandbox-server connections timed out; restarting the temporary server outside the sandbox allowed the checks to pass.
- **Blocked:** Netlify Git connection is at GitHub's **Authorize Netlify** prompt for the owner. Account authorization must be completed by the owner before repository import/publication can continue.
- **Not run:** Netlify build, public HTTPS smoke checks and hosted desktop/mobile browser checks; no public deployment URL is claimed. Live booking/email/storage/concurrency/recovery remain outside this preview milestone.

Environment: Windows; Node 23.2.0, npm 10.9.2; Next.js 16.4.6. Node 22 LTS is the recommended deployment runtime but was not exercised on this host.

## Build and types
- **Pass:** npm run typecheck.
- **Pass:** npm run build; all application routes compile, with dynamic rendering for current admin-managed content.
- Node 23 emits CommonJS/ESM experimental warnings; no build failure.

## Database and input integrity
**Pass: npm test — 13 tests, zero failures.** PGlite runs the real SQL migration with minimal auth/storage fixtures. Its built-in gen_random_uuid replaces only the pgcrypto extension install line.

Verified: authoritative centavo totals and deposit; request idempotency; overlapping room rejection and checkout boundary reuse; expired hold release; RLS guest ownership and denied direct writes; admin-role protection; private receipt metadata; server-only receipt finalization and forged-user denial; transactional receipt/confirmation email jobs; repeat confirmation/submission without duplicate jobs; blackout conflicts; camping guest quotas; custom venue slots; per-booking versus per-night prices; admin configuration persistence; protected active pool assignments; restricted, nonduplicating outbox claims; invalid counts/actions/images/settings.

**Not verified:** simultaneous independent PostgreSQL connections, actual Supabase Auth JWT/session/redirect behavior, bucket policies and signed upload/download transport. PGlite serializes statements and fixtures are not the live Supabase platform.

## HTTP smoke checks
**Pass:** node scripts/smoke.mjs against local server. Final production server: twelve routes return 200: home, stays, detail, camping, gatherings, about, gallery, FAQ, contact, privacy, account, admin. Session responds; unauthenticated cron returns 401; cross-origin mutation returns 400; missing services fail closed; unknown page returns 404.

## Browser and layout review
**Pass, limited to configuration-free preview:** homepage rendering and supplied photos; category filter reduces results to camping; detail navigation; clearly marked draft/no-payment state; admin access/setup state and read-only preview; admin accommodation tab; responsive detail/admin layouts without horizontal document overflow. Mobile hero collision identified and corrected; mobile navigation closes after route changes. Desktop and a requested 390×844 mobile viewport override inspected, then viewport restored.

Screenshots: [desktop](screenshots/homepage.jpg) and [mobile](screenshots/mobile.jpg). Browser review used the Codex in-app browser; no Safari/Firefox/device screen-reader checks were run. Staff modal includes focus trapping/Escape handling; live modal with a real reservation is not browser-verified.

## Live integration / release acceptance
- **Blocked:** AC-01 real registration, persistence, signed receipt upload/reload — no Supabase project credentials.
- **Blocked:** AC-02 actual confirmation email delivery — no Resend sender/domain/key.
- **Blocked:** AC-03 independent concurrent callers against Supabase — no staging project. Local allocation logic passed.
- **Blocked:** AC-04 direct staging Auth/Storage attacks and expired sessions — no staging accounts. Local DB ownership checks passed.
- **Blocked:** AC-05 live admin uploads/publishing — no configured backend; server/UI implementation exists.
- **Blocked:** AC-06 storage/network failure recovery and provider retry delivery — local rules passed; provider transport untested.
- **Not run:** Vercel deployment, backup restoration, multi-browser/device accessibility.

Do not accept real payments before completing these staged checks. No integrations or publication are represented as live.

## Local startup recheck — 25 November 2026

- **Pass:** existing dependencies detected; development server starts on 127.0.0.1:3000.
- **Pass:** `node scripts/smoke.mjs` against the development server; all twelve application routes, session response, unauthenticated cron rejection, cross-origin rejection, missing-service guards, and 404 behavior passed.
- **Pass:** homepage visibly rendered in the browser.
- **Pass:** pre-publication tracked-path audit excludes environment files, dependencies, generated builds and private-key extensions; common credential-pattern scan found no matches. This is a focused scan, not proof that every possible secret format has been detected.

## GitHub connection recheck — 25 November 2026

- **Pass:** connector identifies the selected account as `florenceWebDev`; Git Credential Manager 2.6.0 is installed locally.
- **Pass:** after owner sign-in, the public repository was created under `florenceWebDev`, the local HTTPS remote configured, and the initial push succeeded with `main` tracking `origin/main`. No hosted website deployment is claimed.

## Relocated project verification — 25 November 2026

- **Pass:** complete project moved to the requested `C:\Users\USER\Documents\FG\Projects\yvanders-nature-hills` directory.
- **Pass:** development server restarted from the new location at http://127.0.0.1:3000; route and protected-endpoint smoke checks passed after the move.

## Documentation checks

The handbook and contribution process add npm run docs:test (checker regression tests) and npm run docs:check (links, inventories and change-impact checks). Regression cases cover missing/relevant/unrelated/deleted/empty documentation, per-area requirements, generated/asset/doc exceptions, local links and code samples, endpoint/env drift, unsupported handler styles, computed env access, real Git rename/delete/untracked paths, and merge-base comparisons.

Application database fixtures currently use fixed 2027 dates; update them before that booking window passes. This is a known test-maintenance limit, not a change to booking behavior.

### Rollout verification — 25 November 2026

- **Pass:** all 14 documentation-checker regression tests locally on Windows Node 23.2.0 and in GitHub Actions on Node 22; local links and endpoint/environment inventories passed.
- **Pass:** [complete handbook PR #1](https://github.com/florenceWebDev/yvanders-nature-hills/pull/1), head b22efdb, [Actions run 45520961692](https://github.com/florenceWebDev/yvanders-nature-hills/actions/runs/45520961692) succeeded and merged after the main ruleset was activated.
- **Pass (expected rejection):** [verification PR #2](https://github.com/florenceWebDev/yvanders-nature-hills/pull/2) added only an inert source comment without reference/changelog updates. [Actions run 45521554811](https://github.com/florenceWebDev/yvanders-nature-hills/actions/runs/45521554811) installed successfully and passed checker tests, then failed specifically at handbook/change-impact validation. GitHub displayed the check as Required and disabled Merge pull request. The PR was closed without merging; its source file never entered main. [Captured blocked merge](screenshots/documentation-gate-blocked.jpg).
- **Pass:** saved active [main ruleset](https://github.com/florenceWebDev/yvanders-nature-hills/settings/rules/28036246) requires PRs and Documentation check from GitHub Actions, with zero independent approvals, an empty bypass list, and force-push/deletion blocks. This also applies to the owner; zero approvals avoids requiring a second person. No prior rulesets existed.
- **Pass:** clean clone of merged commit 275fd94 into an isolated folder, no environment file: npm ci, npm run docs:test, npm run docs:check, npm run build, and development server startup. The host npm PowerShell shim consumed forwarded --port flags; npm.cmd run dev -- --port 3002 preserved them and started successfully. README/Operations port-conflict examples now use npm.cmd on Windows. Node 23 emitted experimental module warnings but these checks passed. GitHub Node 22 evidence covers documentation tooling, not the application build on Node 22.
- **Pass:** preview smoke checks against the fresh clone on port 3002 (twelve application routes, session, unauthenticated cron denial, cross-origin rejection, missing-service guards, 404). The temporary verification server was stopped afterward; the owner's existing preview was left running.

The gate enforces changed references/changelog and mechanical consistency; it cannot prove that a prose edit accurately describes a feature. Review remains necessary. This documentation milestone does not establish production readiness. Live service checks remain blocked as recorded above.

## Administration and website audit — 25 November 2026

- **Pass:** npm test — 26 tests, including original booking/input/receipt invariants against both migrations and thirteen administration/report/date/promo/origin scenarios. Opening-balance backfill, 601-row aggregates, duplicate payment/refund retries, per-email and global limits, complimentary review, revoked access and last-admin protection are exercised. Competing promo requests run through PGlite serialization; independent connections remain unverified.
- **Pass:** production build and its TypeScript check; all twelve preview routes and protected-endpoint smoke checks passed. Additional tests/build checks follow any subsequent code changes.
- **Pass:** browser desktop/mobile route coverage, active navigation, tablet header, admin section previews, quarter filter and mobile agenda as detailed in the [audit](AUDIT.md). No real guest/financial data is represented in preview.
- **Blocked:** live connected admin/guest browser writes, invitation-free promotion against real Auth, email delivery, independent database races and hosted deployment require staging credentials. No production database was migrated.

Application validation now runs in GitHub Actions on Node 22 (tests and production build), separately from the required Documentation check (fourteen checker regressions, inventories, links and change-impact). CI results must be verified on the feature PR before merging.

Initial feature CI verified on [PR #4](https://github.com/florenceWebDev/yvanders-nature-hills/pull/4): [Application run 45557063633](https://github.com/florenceWebDev/yvanders-nature-hills/actions/runs/45557063633) passed tests/build on Node 22 and [Documentation run 45557063445](https://github.com/florenceWebDev/yvanders-nature-hills/actions/runs/45557063445) passed. Refund retry coverage also rejects changed details under an already-used request UUID; subsequent PR commits must pass again before merging.

## Final validation checkpoint

- Pass: npm run build and npm run typecheck; the final build uses the same Next CLI with public/service configuration explicitly empty for safe configuration-free smoke testing. Temporary QA route is absent. A stale generated dev validator from that removed fixture was cleared from build output before the successful build.
- Pass: npm run docs:test (14) and npm run docs:check (links, endpoint/environment inventories and impacts).
- Pass: 12 local production-build routes, titles, missing page, scheduler credential denial and cross-origin mutation rejection. Connected anonymous checks returned 401 for admin/bookings and each new admin mutation; no authenticated production write was attempted. API/auth cache headers are private, no-store and the limited CSP is present.
- Pass: local optimized 828px hero response 200, 133,234 bytes versus original 833,933 bytes (84% reduction for that asset).
- Pass: 20 local client static assets contained zero exact matches for the two locally configured privileged values; values were neither logged nor written to audit evidence. Invalid-byte cleanup regression checks registered metadata/lookup failure, and financial finalization errors now preserve objects. Unregistered retained objects require later booking cleanup/operator retention reconciliation.

- Pass: final configuration-free build reports configured:false; all 12 smoke routes and no-service guards pass. The four new admin operations return 400 with a configuration error; connected anonymous checks above returned 401. No protected call succeeded in either mode.

## Requested live release precheck — 26 November 2026

- Pass: PR #10 promoted from draft; implementation commit 28ff7e0 has passing Application, Documentation and Netlify preview checks.
- Pass: read-only Supabase SQL reports accommodations=10, bookings=0, payment_entries=0, receipts=0, payment_ready=true, migration 005 absent. No guest/financial data was copied into repository evidence.
- Blocked: automatic approval review rejected the proposed restricted same-database backup and temporary hold pause as additional production mutations/service interruption requiring explicit approval. Verified the editor still contains only the precheck query; the rejected transaction was not executed. Migration, merge and live deployment were not performed.
- Observed: provider dashboard reports no backups. Proposed in-database snapshot is a migration recovery aid, not an independent backup or verified restore.
