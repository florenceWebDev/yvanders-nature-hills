# 0003 — Temporary Netlify client preview
Date: 2026-11-25
Status: Accepted

## Context
The owner needs a public client-review link before live booking services and permanent hosting are ready.

## Decision
Use owner-owned Netlify hosting connected to protected GitHub main. Build with Node 22 and the automatic Next.js adapter using [netlify.toml](../../netlify.toml). Leave application service credentials unset so the existing draft catalog and non-saving staff demo remain active. Do not enable payments or schedule jobs.

## Alternatives and consequences
Vercel remains the original production candidate; permanent hosting is undecided. Netlify is selected for this temporary review milestone. Preserve server rendering and route handlers instead of converting to static export. A future custom domain can point to Netlify or another compatible host; no domain purchase or DNS change is part of this deployment. Vercel cron configuration does not run on Netlify.

## Verification and follow-up
Record actual build, hosted route, browser and permission checks in [Testing](../TESTING.md). Account/repository authorization may require the owner. Follow [Operations](../OPERATIONS.md) for deployment and rollback. Real booking acceptance, sender DNS, authenticated scheduling, backups and restore remain separate production gates.
