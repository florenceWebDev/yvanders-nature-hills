# Verification evidence — 25 November 2026

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
