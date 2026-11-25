# Configuration and provider setup

The application reads environment values from Next.js; local secrets belong in `.env.local`, copied from [.env.example](../.env.example). That file is ignored by Git. Configure production/staging values in the hosting platform, not in source or public `site_content` records. Isolate future staging from production; the current owner setup below uses the requested permanent project and has not opened real bookings.

## Current owner setup

Netlify now uses the permanent Supabase project on the public HTTPS origin. Migrations 001/002 are applied, all twelve public tables have RLS, and ten actual accommodation drafts remain unpublished. The fictional system-check listing and its three bookings/dependencies were removed on 26 November 2026. Readiness is disabled and the test QR is cleared. Migration 003 and the multi-QR application deployment remain pending. Existing Supabase publishable/secret API keys work with the installed clients; the server secret uses the existing `SUPABASE_SERVICE_ROLE_KEY` variable name. No key values belong in this reference.

The Supabase Auth site URL is `https://yvanders-nature-hills.netlify.app`. The redirect allowlist contains the exact `/auth/callback` URL and `/auth/callback?next=/account?reset=1`. Email confirmation remains enabled. Default Supabase SMTP is limited to organization-authorized recipient addresses and a low sending rate; it is not ready for general guest verification/reset email.

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

Providing only URL/key does not mean booking services are ready. The hold/settings endpoints additionally require service key, booking email key/from, admin email, app URL, and cron secret. After migration 003, a database `payment_ready` flag and one to three complete payment options are also required. Configure labels, images, recipients, instructions and order in Admin → Website & payment. No new environment variables are introduced. Presence checks do not validate actual provider credentials or prove deliverability.

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

Campsite booking staff mailbox. Required by current online-payment readiness checks; booking messages are copied here using BCC as staff alerts. Not a password, but treat the operational address as owner configuration. Granting admin application access is a separate SQL step.

<!-- env: APP_URL -->
### APP_URL

Canonical application origin used in booking-email links. Set `http://127.0.0.1:3000` locally, consistently with auth site/callback URLs; `.env.example` currently uses `http://localhost:3000`, which should be adjusted to the origin you actually use. Use the final HTTPS origin in production. This setting does not create or publish a website.

<!-- env: CRON_SECRET -->
### CRON_SECRET

Strong random server-only scheduler secret, also configured in the scheduler's Authorization header as a bearer token. Never put it in the query string, documentation, or browser. Changing it requires changing the scheduler configuration too. The endpoint uses a timing-safe comparison.

## Other runtime and test settings

`NODE_ENV` is a framework/runtime setting, not an application secret or required `.env.example` entry. Production sets secure session cookies; use the development server for local connected-auth testing and HTTPS for live hosting. `SMOKE_URL` optionally points the smoke script at another local origin (default 127.0.0.1:3000); run its configuration-free expectations against preview data, not a live guest database. GitHub workflow event/base/head variables are CI metadata, not app runtime configuration.

## Connect staging

1. Create a fresh isolated Supabase project and apply [001_booking.sql](../supabase/migrations/001_booking.sql), then [002_administration.sql](../supabase/migrations/002_administration.sql), in order. Verify RLS/functions and storage buckets. Existing databases require additive migrations instead.
2. Set local URL/anon/service keys. Configure Supabase Auth site origin and allowlisted `/auth/callback` URL. Keep email confirmation enabled; use provider-approved SMTP for reliable Auth verification/reset mail.
3. Register and verify the intended staff account. An authorized database administrator explicitly inserts its user ID into `public.admins`; never make this a public endpoint. Use the example in the project [README](../README.md).
4. Optionally run `npx tsx --env-file=.env.local scripts/seed.ts`. It creates missing unpublished drafts by slug; it does not overwrite existing offerings or grant roles. Camping/day-use rates remain unset. Verify room/photo mappings and the Camp Hut resource relationship before publishing.
5. Configure Resend domain DNS and sender, API key, admin mailbox, app URL, cron secret, and authenticated scheduler. Verify both guest and staff mail paths with staging recipients.
6. In staff settings, verify business contact/address/policies and the actual QR recipient. Set prices, capacity pools, guest limits, slots/arrival times, and deposits. Enable payments and publish only verified offerings.
7. Complete the [testing acceptance matrix](TESTING.md) and [release gate](RELEASE.md) before real transactions.

Restart the local server after environment changes; redeploy when production configuration requires it. Never infer successful provider setup merely because environment values are present.
