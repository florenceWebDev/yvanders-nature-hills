# Configuration and provider setup

The application reads environment values from Next.js; local secrets belong in `.env.local`, copied from [.env.example](../.env.example). That file is ignored by Git. Configure production/staging values in the hosting platform, not in source or public `site_content` records. Use separate Supabase projects and test email recipients for staging and production.

## Modes

| Mode | Configuration | Behavior |
| --- | --- | --- |
| Preview | Supabase URL/key absent | Shipped draft listings and non-saving staff preview; no real passwords, payments, uploads, or reservations |
| Connected development | Supabase URL/key present | Public pages load published database rows; auth and schema must exist; query errors show unavailable states |
| Payment-enabled | Complete server settings plus verified public QR instructions | Verified guests can create holds; owner must still complete staged acceptance before taking money |
| Production | HTTPS origin, separate live projects, verified sender, scheduler, policies and restore procedure | Intended real operation; deployment and integrations are not yet verified |

Providing only URL/key does not mean booking services are ready. The hold/settings endpoints additionally require service key, booking email key/from, admin email, app URL, and cron secret. A database `payment_ready` flag and nonempty QR/recipient are also required. Presence checks do not validate actual provider credentials or prove deliverability.

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
