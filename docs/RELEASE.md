# Release and recovery

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
