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
- **Blocked:** live migration 003 and authenticated multi-QR save/reload. Dashboard required sign-in; the owner approved Continue with GitHub after its initial automatic-review rejection. The flow now requires manual GitHub credentials. Existing service credentials were used only for authorized fixture cleanup/verification. No real payment details were configured.
- **Not run:** deployment of the multi-QR application; it requires migration 003 and the feature PR. `npm.cmd run docs:test` passed all 14 documentation-checker tests; `npm.cmd run docs:check` passed local links, endpoint/environment inventories and change-impact coverage.

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
