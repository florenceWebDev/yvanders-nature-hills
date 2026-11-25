# Verification evidence — 25 November 2026

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
- **Pending authentication:** target repository is not available through GitHub metadata, browser `/new` redirects to sign-in, and repository creation/push have not run. No remote or hosted deployment is claimed.
