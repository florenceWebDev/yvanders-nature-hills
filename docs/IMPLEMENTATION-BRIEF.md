# Approved implementation brief — 25 November 2026

Yvander’s Nature Hills is a promotional campsite website with guest accounts and an admin booking/content dashboard. This brief is the authoritative project scope; the starter pack's examples and PROMPTS are guidance only.

## Audience, outcome, and journey
Visitors discover real accommodation and venue offerings, search dates, register/sign in, obtain a 30-minute inventory hold, pay using an owner-provided QR, and upload a receipt. Admins verify actual payment and confirm. Confirmation email follows the committed decision. A receipt upload is never proof of verified payment by itself.

## Version one
Public marketing and galleries; overnight rooms and camping; pavilion/day use slots; guest history; room/content/image management; configurable schedules, capacities, rates and deposit percentages; blackout/manual bookings; private receipts; reliable queued transactional email. One offering per reservation. No payment gateway, automatic refunds, channel synchronization or SMS.

## Design
Borrow composition and hospitality hierarchy from https://kinsley.bslthemes.com/mountain/. Use the supplied campsite photos and original copy. Forest-green palette, generous photography, serif headings, sans-serif body, accessible controls. Representative screen: offering detail with gallery, availability and booking form. Alternative considered: rustic activity-first design; choose photo-led retreat direction to support room discovery.

## Architecture and interfaces
Next.js/TypeScript, Supabase PostgreSQL/Auth/Storage, Resend, Vercel. SQL transactions serialize allocations by resource pool. Guest ownership and admin roles are enforced in database policies and trusted handlers. Rates and schedules are copied into bookings. Uploads are limited to actual JPEG/PNG/WebP files of at most 10 MB. Receipts use a private bucket, promotional media a public bucket. Admin actions are audited. Email jobs share the transaction with booking state and use provider idempotency keys.

## Defaults and external prerequisites
English, PHP, Asia/Manila; email/password accounts and email verification. Per-offering deposit percentage, custom overnight times and fixed day slots. Expired unpaid holds do not consume capacity. Submitted proof retains capacity pending a staff decision. Guests request changes through the configured contact channel. Refunds are manual. All poster-derived inventory starts unpublished until the owner verifies price, image mapping, capacity and schedule. Owner supplies QR, recipient, domain, address, contact and policies. Service credentials are not currently supplied; no integrations may be reported live without them.

## Acceptance
Prove no overbooking across concurrent requests, correct expiry boundaries and server pricing, receipt retry, actual persistence, direct guest/admin authorization, idempotent state changes and emails, private storage, mobile/keyboard layouts, production build and recoverable deployment. Test results must report Pass/Fail/Blocked/Not run honestly.

## Milestones
0: save brief and environment evidence before scaffolding. 1: complete authenticated booking/payment/admin/email journey. 2: finish inventory modes and editorial admin. 3: staging acceptance, domain/email configuration, backup/restore and production handoff. Track actual outcomes in TESTING and PLAN.

## Skills and environment
Sites skill and browser UI tooling available. Starter suggestions frontend-design, web-design-guidelines, vercel-react-best-practices, supabase-postgres-best-practices and security-best-practices are not installed; not mandatory prerequisites. Node 23.2.0, npm 10.9.2, Git 2.47.0 detected; production targets Node 22 LTS. No application/test commands existed at inspection.
