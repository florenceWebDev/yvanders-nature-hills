# Changelog

## 2026-11-26

- Added up to three separately configurable, ordered admin payment QRs with complete previews and responsive guest cards. Existing snapshots retain their instructions.
- Added migration 003 for payment-array conversion, database validation and paid-hold/publication checks. Apply before the matching app deployment.
- Removed the owner-authorized fictional listing, its three bookings/dependencies and test files through a guarded, resumable operator script. Real drafts/accounts are preserved and payments remain disabled.

Record application, configuration, database, and tooling changes under Unreleased in the same PR. Move reviewed entries into a dated version section when an actual release is made. A package version or GitHub push alone does not mean a hosted production release occurred.

## Unreleased

### Appearance and booking management

- Added editable site logo, marketing images/gallery, full semantic palette, image-size guidance and scoped preview; retained contact email settings.
- Aligned administrator creation controls and added the Philippines-time daily reservation table.
- Added owner deletion of active unpaid holds and admin permanent deletion of cancelled reservations, including financial entries. Migration 004 adds guarded database deletion and durable receipt-file cleanup with retries.

### Connected booking services

- Connected Netlify to the permanent Supabase project, applied migrations 001/002, configured exact Auth redirects, seeded ten unpublished accommodation drafts and bootstrapped the verified owner as staff.
- Configured protected live server settings, sending-only Resend access and a minute scheduler through Supabase pg_cron/pg_net and Vault. Owner-approved fictional booking checks passed signed receipt transport, persistence, confirmation, owner inbox delivery, nonadmin permissions and independent capacity contention. Only the labeled nonpayable check is published; real release gates remain. No domain purchase or paid upgrade.

### Temporary client hosting

- Added Node 22 Netlify build configuration for a Git-connected client preview using the existing draft/demo mode. Permanent domain and hosting selection remains separate.
- Documented deployment, rollback, service isolation and production release boundaries; ignored local Netlify state.

### Campsite administration and usability

- Fixed same-origin validation for the real request host when Next.js internally names the server localhost; foreign/malformed origins remain denied.

- Added equal-privilege administrator management for verified existing accounts, protecting the final administrator.
- Added complete period reporting, payment/refund ledger and paginated reservations with month/week/mobile agenda calendar.
- Refund retries require identical details when reusing a request UUID, avoiding silent reuse for a different refund.
- Added customizable promo codes, usage limits, price snapshots and staff-approved complimentary reservations.
- Added persistent active navigation and improved homepage text contrast/tablet/mobile readability.
- Added migration 002 and regression coverage; live-service setup remains pending.

### Documentation and tooling

- Added a developer handbook with codebase map, walkthroughs, API/database references, configuration, operations, and architecture decisions.
- Added documentation link, endpoint/env inventory, and change-impact checks with regression coverage and a GitHub Actions job.
- Added contribution and PR rules requiring documentation with code; active main-branch enforcement was verified with passing and blocked PRs.
- Corrected Windows port-override instructions to preserve flags through the npm PowerShell shim.

### Initial application baseline

- Public promotional and accommodation pages, guest accounts/history, QR-payment proof workflow, admin booking/inventory/content management, and email outbox implemented.
- PostgreSQL owns price, allocation, booking transitions, role checks, and transactional email creation; receipts are private and finalized after server inspection.
- Local project setup and public GitHub source publication completed. Live provider setup, real email delivery, hosting, and restore verification remain pending.
