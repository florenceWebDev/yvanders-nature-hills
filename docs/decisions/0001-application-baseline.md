# 0001 — Application baseline

Date: 2026-11-25
Status: Accepted

## Context

The campsite needs promotional pages, guest accounts, limited inventory booking, manual QR-payment proof verification, editable accommodation/content, and booking emails. Original business rates, resource mapping, QR, and policies require owner verification.

## Decision

Use Next.js/TypeScript for public, guest, and staff experiences; Supabase Auth/PostgreSQL/Storage for identity, transactional allocations, and files; Resend for booking email. Vercel is the selected intended host. Use semantic CSS tokens for the implemented interface. Keep real money transfer external and require staff verification before guest-booking confirmation.

Enforce authoritative money/availability and booking transitions in PostgreSQL. Use scoped original-file uploads with server inspection and a transactional email outbox. Store source and documentation together on GitHub.

## Alternatives and consequences

A complete booking gateway or WordPress theme integration would add provider-specific payment/plugin behavior beyond the selected manual process. The reference hotel site informs visual composition; its content/code/assets are not the app implementation. A managed relational backend supports the allocation transactions better than browser-only state. This adds service setup, RLS, migration, scheduler, and backup responsibilities.

Tailwind was in the early recommendation; the delivered interface uses shared plain CSS tokens instead. The current code and design guide are authoritative for styling. No separate CMS or documentation hosting service is required for this scope.

## Verification and follow-up

The local UI, production build, validation, and PostgreSQL fixture tests have recorded evidence. Live Supabase auth/storage/concurrency, real sender delivery, hosting, and backup restoration remain unverified. See [TESTING](../TESTING.md) and [current handoff](../PLAN.md).
