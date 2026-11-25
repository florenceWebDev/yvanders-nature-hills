# Yvander’s Nature Hills

A campsite promotion and booking app built with Next.js/TypeScript, Supabase Auth/PostgreSQL/Storage, and a Resend booking-email adapter. Public source: [florenceWebDev/yvanders-nature-hills](https://github.com/florenceWebDev/yvanders-nature-hills).

**Current status:** [the Netlify website](https://yvanders-nature-hills.netlify.app/) uses the owner's permanent Supabase database. Staff access, booking persistence, signed proof transport, confirmation, owner inbox delivery and an independent capacity race have passed live checks. Only an explicitly labeled fictional system-check listing is bookable; do not send money. Ten actual accommodation drafts remain unpublished. General guest email, verified business configuration and recovery/failure-path checks remain incomplete. See [current handoff](docs/PLAN.md).

## Start locally

Use Node 22 LTS or newer, npm, and Git:

```powershell
git clone https://github.com/florenceWebDev/yvanders-nature-hills.git
cd yvanders-nature-hills
npm ci
npm run dev
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000). Keep the terminal open; stop with **Ctrl+C**. If you already have this checkout with dependencies installed, run only `npm run dev` from its folder. The owner's prepared folder is `C:\Users\USER\Documents\FG\Projects\yvanders-nature-hills`.

Without `.env.local`, the app opens in configuration-free preview mode. Accommodation: [/stays](http://127.0.0.1:3000/stays). Guest setup: [/account](http://127.0.0.1:3000/account). Staff preview: [/admin](http://127.0.0.1:3000/admin), then **Explore admin preview**. If port 3000 is occupied, use `npm.cmd run dev -- --port 3001` and the corresponding origin; do not stop unrelated servers.

For a production-build preview, run `npm run build`, then `npm start`. Use the development server for local connected-auth work; live hosting must use HTTPS.

## Developer documentation

Netlify hosts the Next.js application with Node 22. See the [connected-service runbook](docs/OPERATIONS.md#connected-netlify-services) for settings, scheduling and rollback. A custom domain remains deferred; account and booking emails currently have provider restrictions described in [Configuration](docs/CONFIGURATION.md#current-owner-setup).

Begin with the [handbook index](docs/README.md). New developers should read [Development](docs/DEVELOPMENT.md), [Architecture](docs/ARCHITECTURE.md), and [current handoff](docs/PLAN.md).

| Task | Reference |
| --- | --- |
| Understand folders and add a feature | [Development guide](docs/DEVELOPMENT.md) |
| Integrate or change an endpoint | [API reference](docs/API.md) |
| Understand data, permissions, states, pricing and migrations | [Database reference](docs/DATABASE.md) |
| Set environment values and provider accounts | [Configuration](docs/CONFIGURATION.md) |
| Deploy, retry email, troubleshoot or restore | [Operations](docs/OPERATIONS.md) and [release gate](docs/RELEASE.md) |
| Understand requirements and visual conventions | [Project](docs/PROJECT.md) and [Design](docs/DESIGN.md) |
| See checks and their real limits | [Testing](docs/TESTING.md) |
| Understand why choices were made | [Architecture decisions](docs/decisions/README.md) |
| See what changed | [Changelog](CHANGELOG.md) |

## Changes must include documentation

Follow [CONTRIBUTING](CONTRIBUTING.md): work on a feature branch, update affected canonical references and changelog, run relevant checks, and open a pull request. Documentation is checked on GitHub and required before merging to main. The checker detects mechanical omissions; reviewers must verify explanations and examples against the code. Coding agents follow the same requirements in [AGENTS](AGENTS.md).

```powershell
npm run docs:test
npm run docs:check
```

`docs:check` compares local changes with `origin/main` and checks local links, the endpoint inventory, and environment-variable coverage. For committed changes: `node scripts/docs-check.mjs --base REF --head HEAD`. See the contribution guide for exact change-impact rules and supported syntax.

Application validation: `npm test`. Generate Next.js types through dev/build before `npm run typecheck` in a fresh clone. `npm run build` performs the production build and its TypeScript check. With a preview server already running, `node scripts/smoke.mjs` verifies HTTP routes and configuration-free safety states. Do not use preview-specific smoke expectations against real guest data.

## Connect real booking services

Follow [Configuration](docs/CONFIGURATION.md) in an isolated staging project. For a fresh Supabase project apply 001_booking.sql then 002_administration.sql; an existing 001 database needs only 002, configure auth callbacks/SMTP/storage and server secrets, register/verify a staff account, and explicitly promote the intended account:

```sql
insert into public.admins(user_id)
select id from auth.users where email = 'YOUR_VERIFIED_STAFF_EMAIL'
on conflict do nothing;
```

Optionally seed unpublished drafts with `npx tsx --env-file=.env.local scripts/seed.ts`. Verify rates, room/photo mapping, capacities, schedules, deposits, contact/policies, and the actual QR recipient before publishing. Administrators can add verified existing accounts through the Administrators section after the initial staff account is bootstrapped. Configure Resend and the authenticated scheduler, then complete the [acceptance matrix](docs/TESTING.md). Environment values being present are not proof of operational services.

Keep `.env.local`, service keys, auth codes, real guest details, private receipts, and signed URLs out of this public repository. The [example environment](.env.example) contains variable names and placeholders only. No software license has been selected. [Screenshots](docs/screenshots/homepage.jpg) illustrate the local design, not live-service verification.
