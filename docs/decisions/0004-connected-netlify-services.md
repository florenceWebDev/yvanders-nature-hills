# 0004 — Connected Netlify services
Date: 2026-11-25
Status: Accepted

## Context

The owner wants booking checks on the existing public site before buying a domain, using the permanent database. This advances the preview-only decision [0003](0003-temporary-netlify-preview.md).

## Decision

Retain Netlify and connect permanent Supabase Auth/PostgreSQL/Storage. Apply migrations 001/002, retain RLS and private receipts, and seed unpublished real accommodation drafts. Keep server/email credentials secret and unavailable to nonproduction deployed contexts. Use sending-only Resend access. Schedule the authenticated outbox with Supabase pg_cron/pg_net and a Vault token.

## Alternatives and consequences

Vercel was the initial candidate; moving the existing host is unnecessary for this milestone. Its cron manifest does not run on Netlify. A separate staging project remains appropriate for future destructive testing; preserve real records once operations begin. Explicitly label fictional system-check records and never treat them as payment evidence. No domain purchase or paid upgrade is included. Default sender/Auth SMTP restrictions permit limited owner testing, not general guest email. Quotas, inactivity and recovery need operational review before accepting money.

## Verification and follow-up

[Testing](../TESTING.md#connected-services--25-november-2026) records live connection, schema, staff bootstrap, fictional booking/receipt/confirmation, owner inbox, direct permissions and independent capacity contention checks. Verified business inventory/payment instructions, general guest mail, manual browser file selection, remaining failure paths and restore remain incomplete. The explicitly approved system-check listing is the only published offering; disable its readiness flag and exclude fictional financial records before launch.
