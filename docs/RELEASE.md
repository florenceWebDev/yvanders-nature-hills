# Release and recovery

## Current deployment — 26 November 2026

[PR #8](https://github.com/florenceWebDev/yvanders-nature-hills/pull/8) merged with passing Application, Documentation and Netlify preview checks. Netlify published main `51c4b84`; migration 004 was applied through SQL Editor before the merge. Live admin controls and public routes were checked; anonymous deletion is denied and the scheduled cleanup/email worker returns HTTP 200 with zero errors on an empty queue. Ten accommodations, three published entries, one booking and enabled payments were preserved. No production deletion or branding changes were used as tests. Actual destructive-flow/storage-cleanup/concurrency/restore acceptance remains as listed in TESTING.

## Previous cleanup checkpoint — 26 November 2026

The fictional fixture, three bookings and dependencies were permanently removed through the guarded operator script. Ten real drafts are preserved/unpublished; readiness is off. Multi-QR administration is implemented and locally checked; migration 003 is applied and production deployment is Published at main `11e37b5` through the owner-approved PR #6 merge. On new projects apply 003 after 002 before deploying the matching app; verify real images/recipients before enabling holds. General guest mail and prior unverified recovery/failure paths remain separate. Connected-status sections below are historical.

## Current connected status — 25 November 2026

The public [Netlify site](https://yvanders-nature-hills.netlify.app/) is connected to the permanent Supabase database. Migrations 001/002, RLS/storage, protected server settings, a sending-only Resend credential and external minute scheduler are configured. Live session reports configured; scheduled requests return HTTP 200 with an empty queue. Owner registration/verification and first staff bootstrap succeeded. No domain purchase or paid upgrade was made.

Owner-approved fictional booking checks passed persistence, signed proof transport, confirmation, owner inbox delivery, nonadmin ownership/storage denial and independent capacity contention. Real booking release still requires verified business configuration, general guest email, manual browser upload verification, remaining failure-path checks and restore. Only a clearly labeled nonpayable system-check listing is published; ten actual drafts remain unpublished. Disable its readiness flag and unpublish it, and exclude fictional financial records before real operations. See [current handoff](PLAN.md) and [Testing](TESTING.md#connected-services--25-november-2026). The sections below preserve earlier release checkpoints and hosting candidates.

## Temporary client preview — 25 November 2026

Netlify is selected for temporary client review using configuration-free draft/demo mode (see [ADR 0003](decisions/0003-temporary-netlify-preview.md)). Hosting configuration is prepared; publication and hosted verification are pending. No real booking credentials, domain purchase, DNS changes or production booking release are included. The Vercel target below is the original candidate; final hosting remains undecided.

Target: Vercel + isolated Supabase projects for staging/production, Resend owned sending domain. Owner supplies accounts, QR, current rates/capacities/schedules, address/contact/policies. No credentials have been supplied.

Apply SQL migration; configure storage/auth redirects and server secrets; promote first admin using SQL; set verified payment instructions and offerings; verify sender DNS; deploy; configure authenticated cron for outbox/expiry; run staged booking/receipt/approval journey; test restore before accepting real payments.

Rollback application to prior deployment; forward-fix database with additive migrations. Retain backups according to owner account plan; do not assume code rollback undoes data. Monitor queued/failed emails, pending payment reviews, storage errors and allocation conflicts. Admin owns daily review and manual refund handling.

## Actual result
Local production build passed and was previewed. No hosted Vercel deployment exists: account access and runtime service configuration were not supplied. No credentials are included in the deliverable. Configure the authenticated scheduler and verify real email/storage before enabling payments. Keep this source checkpoint as the initial rollback reference; no production database has been migrated.
## Administration expansion staging gate

Apply migration 002 after 001 and validate opening balances before deploying the matching app. Use isolated test accounts/data to verify:

- Two administrators can promote/revoke verified accounts; concurrent removals cannot leave zero administrators. Revoked sessions cannot perform later admin requests.
- Independent callers competing for the final promo use (including different inventory pools) produce only one reservation. Expired unpaid uses release; paid or approved complimentary uses remain consumed after cancellation.
- A complimentary guest is queued for approval without QR/proof, receives a real pending/confirmation email, and cannot upload a receipt. Manual complimentary bookings are already staff-approved.
- Concurrent payment/refund requests preserve ledger totals and refund bounds. Compare received-date collections against arrival-date booking value, including cancellations and opening entries.
- More than 500 reservations remain reachable through list pages and the selected calendar range. Verify occupied dates, overnight slots, blackouts and mobile agenda against the actual database.

These live checks remain pending until provider credentials are configured; local fixtures do not replace them.

## Appearance and booking-management release procedure

Migration 004 and the matching application are deployed as recorded above. For future environments: Apply 004 after 003 before release. Verify owner/status deletion boundaries, daily pagination and actual delayed receipt cleanup on isolated staging. Permanent cancelled deletion erases financial entries and changes historical reports. Keep cleanup processing alive during rollback; previous application code cannot restore erased records. See ADR 0006 and Operations.

## Pending release: migration 005

Payment/settings/audit changes are implemented locally and prepared for the protected feature PR. Production remains on migration 004; no live ledger, booking, QR or configuration was changed by this work. Apply 005 and matching application as a coordinated release using [Operations](OPERATIONS.md#release-migration-005-and-payment-recovery). Legacy financial review is intentionally closed after migration, so pause holds/staff review during the brief transition. Live upload/link expiry, independent contention and postdeploy provider checks remain pending. Existing general guest SMTP/sender and restore limits are not resolved by this feature.
