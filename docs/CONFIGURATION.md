# Configuration and provider setup

The application reads environment values from Next.js; local secrets belong in `.env.local`, copied from [.env.example](../.env.example). That file is ignored by Git. Configure production/staging values in the hosting platform, not in source or public `site_content` records. Isolate future staging from production; the current owner setup below uses the requested permanent project and has not opened real bookings.

## Current owner setup

Use the [deployment handbook](DEPLOYMENT.md) for updates. The build-ignore script reads Netlify-provided `CACHED_COMMIT_REF` and `COMMIT_REF`; these are build metadata, not new application secrets or `.env.example` entries. Missing metadata builds normally. There are no new application environment variables. Changes to hosting environment values require an explicit redeploy even when source changes are documentation-only.

As of the booking experience rollout on 26 November 2026, migrations 001–006 are applied and Netlify serves the c6a911d application release. Booking readiness and scheduling are enabled. Auth redirects contain the two previous entries and https://yvanders-nature-hills.netlify.app/auth/callback?** for encoded booking returns and reset=1. Sender/SMTP restrictions below remain unresolved; prepared HTML has not been activated as a general-recipient sender. Older rollout counts in this section describe their dated checkpoints.

Netlify now uses the permanent Supabase project on the public HTTPS origin. Migrations 001–004 are applied and application tables have RLS. At the appearance rollout, ten accommodations existed, three were published and one booking existed; owner-configured payments were enabled. The fictional system-check listing and its three bookings/dependencies were removed on 26 November 2026. The test QR was cleared at the cleanup checkpoint; the owner subsequently configured payments and enabled readiness. Migration 003 is applied and the multi-QR application is deployed through PR #6 at main `11e37b5`. Appearance and booking-management PR #8 is now deployed at main 51c4b84 after applying migration 004; the owner manages payment options through admin. Existing Supabase publishable/secret API keys work with the installed clients; the server secret uses the existing `SUPABASE_SERVICE_ROLE_KEY` variable name. No key values belong in this reference.

The Supabase Auth site URL is `https://yvanders-nature-hills.netlify.app`. The redirect allowlist contains the exact /auth/callback URL, legacy /auth/callback?next=/account?reset=1 and the fixed-origin /auth/callback?** query pattern. Email confirmation remains enabled. Default Supabase SMTP is limited to organization-authorized recipient addresses and a low sending rate; it is not ready for general guest verification/reset email.

Resend uses a sending-only key and `onboarding@resend.dev`. This default sender permits mail to the Resend account's own address; general guest delivery requires an owned verified sending domain. `ADMIN_EMAIL` is owner configuration, not an automatic admin grant. No domain has been purchased and no Auth SMTP has been added.

Netlify live server/email keys are marked secret. Other deployed contexts use nonworking placeholders for these keys, and the scheduler secret is scoped to Live app. Public URL/key and nonsecret origin/sender settings are also configured. This is context isolation of credentials, not a separate staging database. Environment changes require a redeploy. See [Operations](OPERATIONS.md#connected-netlify-services) for the external scheduler and [Testing](TESTING.md#connected-services--25-november-2026) for observed limits.

## Modes

For the temporary Netlify client preview, use [netlify.toml](../netlify.toml): repository root, `npm run build`, publish `.next`, Node 22. Netlify installs its Next.js adapter automatically. Leave every application service environment value unset in every deployment context, including inherited team values; in particular, do not set the Supabase URL/key pair. No live secrets, auth callbacks, database migration or scheduler are required for this demo. Netlify-managed build variables are platform settings, not new application environment entries.

| Mode | Configuration | Behavior |
| --- | --- | --- |
| Preview | Supabase URL/key absent | Shipped draft listings and non-saving staff preview; no real passwords, payments, uploads, or reservations |
| Connected development | Supabase URL/key present | Public pages load published database rows; auth and schema must exist; query errors show unavailable states |
| Payment-enabled | Complete server settings plus verified public QR instructions | Verified guests can create holds; owner must still complete staged acceptance before taking money |
| Production | HTTPS origin, isolated service configuration, verified sender, scheduler, policies and restore procedure | Real operation requires acceptance beyond the current fictional owner check |

Providing only URL/key does not mean booking services are ready. The hold/settings endpoints additionally require service key, booking email key/from, app URL, and cron secret. After migration 003, a database `payment_ready` flag and one to three complete payment options are also required. Configure labels, images, recipients, instructions and order in Admin → Website & payment. No new environment variables are introduced. Presence checks do not validate actual provider credentials or prove deliverability.

## Environment inventory

Comments identify checked configuration entries; keep one marker and explanation for every example-file key. `npm run docs:check` compares them and verifies runtime references have example entries.

<!-- env: NEXT_PUBLIC_SUPABASE_URL -->
### NEXT_PUBLIC_SUPABASE_URL

Supabase project HTTPS URL. Required with the anon key to leave preview mode. Public project identifier, not a secret. Use the same project as the server service key.

<!-- env: NEXT_PUBLIC_SUPABASE_ANON_KEY -->
### NEXT_PUBLIC_SUPABASE_ANON_KEY

Project anon/publishable-compatible API key used by the current Supabase clients. Publicly exposable only with correct RLS and grants; never substitute the service-role key. The variable's existing name remains part of setup compatibility.

<!-- env: SUPABASE_SERVICE_ROLE_KEY -->
### SUPABASE_SERVICE_ROLE_KEY

Server-only privileged project key. Used for signed file operations, verified receipt finalization, scheduler processing, and staff email retries. It bypasses RLS. Rotate through the provider if exposed and update every server environment; never print or share it in support evidence.

<!-- env: RESEND_API_KEY -->
### RESEND_API_KEY

Server-only Resend sending key for booking notifications. Use an appropriately restricted key for the verified sender. Supabase account verification/reset mail has separate SMTP configuration; adding this value alone does not configure Auth mail.

<!-- env: EMAIL_FROM -->
### EMAIL_FROM

Verified booking sender, e.g. `Yvander's Nature Hills <bookings@example.test>` as a fictional format example. Replace with an owned verified domain. The template value is not usable for real sending.

<!-- env: ADMIN_EMAIL -->
### ADMIN_EMAIL

Legacy optional mailbox setting retained for configuration compatibility. Migration 006 staff alerts use verified current admins from the database; the worker no longer BCCs this address and readiness checks do not require it. Granting admin application access remains a separate SQL step.

<!-- env: APP_URL -->
### APP_URL

Canonical application origin used in booking-email links. Set `http://127.0.0.1:3000` locally, consistently with auth site/callback URLs; `.env.example` currently uses `http://localhost:3000`, which should be adjusted to the origin you actually use. Use the final HTTPS origin in production. This setting does not create or publish a website.

<!-- env: CRON_SECRET -->
### CRON_SECRET

Strong random server-only scheduler secret, also configured in the scheduler's Authorization header as a bearer token. Never put it in the query string, documentation, or browser. Changing it requires changing the scheduler configuration too. The endpoint uses a timing-safe comparison.

## Other runtime and test settings

`NODE_ENV` is a framework/runtime setting, not an application secret or required `.env.example` entry. Production sets secure session cookies; use the development server for local connected-auth testing and HTTPS for live hosting. `SMOKE_URL` optionally points the smoke script at another local origin (default 127.0.0.1:3000); run its configuration-free expectations against preview data, not a live guest database. GitHub workflow event/base/head variables are CI metadata, not app runtime configuration.

## Connect staging

1. Create a fresh isolated Supabase project and apply [001_booking.sql](../supabase/migrations/001_booking.sql), then [002_administration.sql](../supabase/migrations/002_administration.sql), [003_payment_options.sql](../supabase/migrations/003_payment_options.sql), and [004_appearance_deletion.sql](../supabase/migrations/004_appearance_deletion.sql), in order. Verify RLS/functions and storage buckets. Existing databases require additive migrations instead.
2. Set local URL/anon/service keys. Configure Supabase Auth site origin and allowlisted `/auth/callback` URL. Keep email confirmation enabled; use provider-approved SMTP for reliable Auth verification/reset mail.
3. Register and verify the intended staff account. An authorized database administrator explicitly inserts its user ID into `public.admins`; never make this a public endpoint. Use the example in the project [README](../README.md).
4. Optionally run `npx tsx --env-file=.env.local scripts/seed.ts`. It creates missing unpublished drafts by slug; it does not overwrite existing offerings or grant roles. Camping/day-use rates remain unset. Verify room/photo mappings and the Camp Hut resource relationship before publishing.
5. Configure Resend domain DNS and sender, API key, admin mailbox, app URL, cron secret, and authenticated scheduler. Verify both guest and staff mail paths with staging recipients.
6. In staff settings, verify business contact/address/policies and the actual QR recipient. Set prices, capacity pools, guest limits, slots/arrival times, and deposits. Enable payments and publish only verified offerings.
7. Complete the [testing acceptance matrix](TESTING.md) and [release gate](RELEASE.md) before real transactions.

Restart the local server after environment changes; redeploy when production configuration requires it. Never infer successful provider setup merely because environment values are present.

## Appearance/deletion release requirement

Apply migration 004 after 003 before deploying this application. Branding, marketing images, palette and contact email use public site settings; they require no new environment values. Keep the existing cron secret and service-role storage access configured for durable receipt cleanup. Email sender/ADMIN_EMAIL configuration remains separate from public contact email.

## Payment/settings audit configuration

Migration 005 adds no environment variable, bucket or credential. Configure the method on each QR option in Payment Settings when next saving that section. Existing snapshots retain legacy options and remain readable. Bundled images use the existing Next image optimizer; remote owner URLs remain unoptimized, so no wildcard remote-image allowlist is introduced. next.config.ts adds a limited CSP and explicit private/no-store for API/auth routes. This CSP does not restrict scripts or Google Fonts.

## Branded verification and recovery mail

Supabase still verifies accounts. Configure custom SMTP using the existing email provider after the owner supplies an owned domain, verifies its sending DNS records and chooses an authorized sender. Use Yvander’s Nature Hills as the sender name. The booking-email API key alone does not configure Supabase SMTP. Do not put SMTP credentials in this repository or public site settings.

Prepared dashboard templates: [confirmation](../supabase/templates/confirmation.html) and [recovery](../supabase/templates/recovery.html). Paste the matching HTML into Supabase Auth email templates while preserving the ConfirmationURL variable. Configure SMTP host/port/user/password in Supabase; use TLS settings required by the provider. Retain email confirmation. Test signup and password recovery with authorized isolated recipients and verify actual inbox delivery and return to the booking draft.

Add the exact production callback pattern https://yvanders-nature-hills.netlify.app/auth/callback?** to Supabase’s redirect allowlist to permit encoded booking returns and reset=1. Keep the origin/path fixed; do not use an unrestricted host wildcard. Add only corresponding exact local/staging origins when needed. Keep the legacy callback/reset entries during transition.

No owned domain is available yet. Custom sender activation and unrestricted guest delivery remain Blocked; these HTML files are prepared assets, not applied provider configuration. See the [official SMTP guide](https://supabase.com/docs/guides/auth/auth-smtp) and [template guide](https://supabase.com/docs/guides/auth/auth-email-templates).

## Audit hardening configuration (not yet deployed)

<!-- env: RATE_LIMIT_HMAC_SECRET -->
### RATE_LIMIT_HMAC_SECRET

Server-only random secret of at least 32 characters, shared by every application instance in one environment. Generate/store through the host secret mechanism, never site settings, source or logs. Counters use HMAC-SHA256 of scoped user/IP/email identities. Missing/short secret returns 503 for protected HTTP routes. Rotation starts new counter keys; old keys expire normally, so coordinate rotation and avoid using it to evade limits. Staging must use its own secret and database.

<!-- env: SITE_ID -->
### SITE_ID

Read-only provider-supplied Netlify runtime site UUID. NETLIFY is build-only metadata and is deliberately not used for runtime trust. Anonymous limits trust only a syntactically valid x-nf-client-connection-ip header there, ignoring X-Forwarded-For. Leave unset for local development; nonproduction localhost uses a shared local-development identity. Production on another host fails closed until a verified ingress adapter is implemented. A 007 release must verify actual adapter/header delivery and spoof resistance on an isolated hosted environment before production. Do not manually set a site UUID to make another host pass. The runtime guarantee is documented in [Netlify function environment variables](https://docs.netlify.com/build/functions/environment-variables/).

Migration 007 and the HMAC secret must be ready before publishing this application. The existing Supabase service credential is now also required for anonymous quotes and all configured session/limit operations. Private abuse tables grant no client table access. The worker uses the existing cron secret, conservative shared one-send/second pacing and provider-directed cooldowns; no Redis subscription or new email credential is needed.

Fonts are vendored from the official Google Fonts repository under src/app/fonts with both SIL Open Font License texts. next/font/local serves them from the app; builds no longer fetch Google fonts. Image remotePatterns permits only HTTPS public marketing objects on the configured Supabase hostname. Other owner HTTPS images remain direct browser images.
