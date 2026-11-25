# Yvander’s Nature Hills

A Next.js booking application with a photographic public website, guest accounts, QR-payment receipt uploads, and a protected admin workspace. Backend: Supabase PostgreSQL/Auth/Storage. Transactional email: Resend. Recommended hosting: Vercel.

## Run locally

Use Node 22 LTS or newer:

```powershell
npm install
npm run dev
```

Open http://127.0.0.1:3000. Without service configuration the app renders clearly marked draft listings and a read-only admin preview. It does not pretend to book, accept payments, or send email.

## Connect real services

1. Create an isolated Supabase staging project. Run `supabase/migrations/001_booking.sql` in its SQL editor. The migration is intended for a fresh project, not an existing production schema.
2. Copy `.env.example` to `.env.local`; configure the Supabase project URL, anon key, server-only service-role key, Resend key, verified EMAIL_FROM, ADMIN_EMAIL, APP_URL, and a strong CRON_SECRET. Never commit `.env.local`.
3. Configure Supabase Auth site URL and allowed callback URL `http://127.0.0.1:3000/auth/callback` (plus production hostname after deployment). Keep email confirmation enabled. Configure custom SMTP for production auth mail, using Resend SMTP credentials if desired.
4. Register and verify your staff account through `/account`. In Supabase SQL editor, explicitly promote the correct account:

```sql
insert into public.admins(user_id)
select id from auth.users where email = 'YOUR_VERIFIED_STAFF_EMAIL'
on conflict do nothing;
```

5. Optional: `npx tsx --env-file=.env.local scripts/seed.ts` creates unpublished poster-based drafts. Photos are campsite examples, not verified room mappings. Camping/day-use rates are unset; configure them. Never publish unverified drafts.
6. Open `/admin`. Configure business contact, address, policies, verified payment QR and recipient; enable payments. Verify each offering's prices, deposit percentage, capacity pool, maximum guests, photos, and schedule before publication. Named tent pitches can be separate offerings with capacity-one pools; pooled camping uses a shared resource capacity. The two Camp Hut listings need review for shared physical resources.
7. Configure Resend domain DNS and EMAIL_FROM. ADMIN_EMAIL receives copies of guest booking messages as staff alerts. Set APP_URL to your actual origin.
8. Schedule authenticated `GET /api/jobs` every minute with `Authorization: Bearer <CRON_SECRET>`. The included Vercel cron requires a plan supporting minute schedules; otherwise use an external scheduler with the same authentication. Limit each run to 20 jobs. Protect the secret. Check Email & Activity in admin for failed messages.

## Booking rules

- Public browsing is open; creating holds requires a verified account.
- A database transaction locks the inventory pool before allocating. Exclusive units and shared guest quotas use the same overlap checks.
- Prices, deposit and payment instructions are snapshotted. Guest-provided totals/status are ignored.
- Unpaid holds expire after 30 minutes. Expired holds never consume availability, even if the scheduled job is delayed.
- Successful receipt submission changes the state to pending review and retains capacity. Staff verify actual receipt of money before confirmation. Correction requests retain capacity until staff decide.
- Guests see their own reservations and receipts only. Authenticated admin checks protect configuration, payment reviews and all staff reads. No public receipt URLs.
- Receipt uploads support JPEG/PNG/WebP up to 10 MB, checked by signature and stored in a private bucket. Marketing images use a separate public bucket.
- Cancellation/refunds are staff-managed. Refund notes are internal. Balance recording updates cumulative verified payment.
- One offering per reservation; multi-night stays supported. Venue/day-use slots are defined by admins. Times use Asia/Manila; money is stored in centavos.

## Checks

```powershell
npm run typecheck
npm test
npm run build
npm start
```

Actual verification outcomes and remaining limits are in `docs/TESTING.md`. Database and email acceptance must also run against configured staging; a successful build is not evidence of integration delivery.

## Release and recovery

Deploy as Next.js to Vercel, set server environment values there, and configure production callbacks/scheduler. Use separate Supabase staging/production projects. Complete `docs/RELEASE.md` and verify business/privacy text, backup/restore, two-guest allocation conflicts, receipt access, admin approval and actual email delivery before accepting money. Roll back app versions through hosting; apply database forward fixes carefully. Do not assume app rollback undoes booking data.

The original starter remains untouched. `docs/IMPLEMENTATION-BRIEF.md` records the user's agreed requirements; starter examples are not extra requirements.

See `docs/screenshots/` for desktop and mobile preview captures. The source ZIP excludes dependencies, build outputs, Git internals, and secrets.
