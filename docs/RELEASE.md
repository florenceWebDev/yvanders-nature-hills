# Release and recovery

Target: Vercel + isolated Supabase projects for staging/production, Resend owned sending domain. Owner supplies accounts, QR, current rates/capacities/schedules, address/contact/policies. No credentials have been supplied.

Apply SQL migration; configure storage/auth redirects and server secrets; promote first admin using SQL; set verified payment instructions and offerings; verify sender DNS; deploy; configure authenticated cron for outbox/expiry; run staged booking/receipt/approval journey; test restore before accepting real payments.

Rollback application to prior deployment; forward-fix database with additive migrations. Retain backups according to owner account plan; do not assume code rollback undoes data. Monitor queued/failed emails, pending payment reviews, storage errors and allocation conflicts. Admin owns daily review and manual refund handling.

## Actual result
Local production build passed and was previewed. No hosted Vercel deployment exists: account access and runtime service configuration were not supplied. No credentials are included in the deliverable. Configure the authenticated scheduler and verify real email/storage before enabling payments. Keep this source checkpoint as the initial rollback reference; no production database has been migrated.
