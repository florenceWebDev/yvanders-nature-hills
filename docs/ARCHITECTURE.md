# Architecture

Next.js App Router + TypeScript. Supabase PostgreSQL/Auth/Storage. Resend transactional email. Vercel deployment. See IMPLEMENTATION-BRIEF.md and database migration for contracts.

Public reads expose published offerings and editorial content only. All mutations use authenticated server handlers; database functions derive ownership from auth.uid(). Admin is determined by a private role table, never client input. Resource-pool row locks serialize hold/manual-booking operations; allocations use half-open time intervals. Browser input never chooses final price or payment status. Booking snapshots preserve amounts and schedules.

Private receipt bucket; public marketing bucket. Only server-authorized signed receipt URLs. Outbox email jobs commit with transitions and have stable provider idempotency IDs. Cron job retries email and expires unpaid holds. HTTP-only same-site auth cookies. Separate staging/production; service-role key remains server-only.

## Implemented details
Semantic CSS tokens style the app; there is no Tailwind runtime. Public content renders per request. Original files upload via scoped signed Supabase URLs to avoid hosting body limits; the server downloads and checks signatures before the service-only receipt-finalization function. Guest ownership is validated before every signed URL. Refund details stay in admin-only audit records. SQL locks offering then resource during holds/configuration to prevent pool-change races. Service-readiness checks prevent online-payment activation with missing email/storage configuration. Current admin/guest reads show the most recent 500 rows; search/filter applies to that loaded set. Expand pagination before exceeding this operating size.
