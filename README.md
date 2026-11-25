# Yvander’s Nature Hills

A campsite promotion and booking app built with Next.js/TypeScript, Supabase Auth/PostgreSQL/Storage, and a Resend booking-email adapter. Public source: [florenceWebDev/yvanders-nature-hills](https://github.com/florenceWebDev/yvanders-nature-hills).

**Current status:** local preview and application implementation exist; live Supabase, email delivery, hosting, and restore verification remain pending. Preview listings are drafts and cannot accept real reservations or payments.

## Start locally

Use Node 22 LTS or newer, npm, and Git:

```powershell
git clone https://github.com/florenceWebDev/yvanders-nature-hills.git
cd yvanders-nature-hills
npm ci
npm run dev
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000). Keep the terminal open; stop with **Ctrl+C**. If you already have this checkout with dependencies installed, run only `npm run dev` from its folder. The owner's prepared folder is `C:\Users\USER\Documents\FG\Projects\yvanders-nature-hills`.

Without `.env.local`, the app opens in configuration-free preview mode. Accommodation: [/stays](http://127.0.0.1:3000/stays). Guest setup: [/account](http://127.0.0.1:3000/account). Staff preview: [/admin](http://127.0.0.1:3000/admin), then **Explore admin preview**. If port 3000 is occupied, use `npm run dev -- --port 3001` and the corresponding origin; do not stop unrelated servers.

For a production-build preview, run `npm run build`, then `npm start`. Use the development server for local connected-auth work; live hosting must use HTTPS.

## Developer documentation

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

Follow [CONTRIBUTING](CONTRIBUTING.md): work on a feature branch, update affected canonical references and changelog, run relevant checks, and open a pull request. Documentation is checked on GitHub and required before merging to main once the documented rollout is verified. The checker detects mechanical omissions; reviewers must verify explanations and examples against the code. Coding agents follow the same requirements in [AGENTS](AGENTS.md).

```powershell
npm run docs:test
npm run docs:check
```

`docs:check` compares local changes with `origin/main` and checks local links, the endpoint inventory, and environment-variable coverage. For committed changes: `npm run docs:check -- --base REF --head HEAD`. See the contribution guide for exact change-impact rules and supported syntax.

Application validation: `npm test`. Generate Next.js types through dev/build before `npm run typecheck` in a fresh clone. `npm run build` performs the production build and its TypeScript check. With a preview server already running, `node scripts/smoke.mjs` verifies HTTP routes and configuration-free safety states. Do not use preview-specific smoke expectations against real guest data.

## Connect real booking services

Follow [Configuration](docs/CONFIGURATION.md) in an isolated staging project. Apply the initial SQL only to a fresh Supabase project, configure auth callbacks/SMTP/storage and server secrets, register/verify a staff account, and explicitly promote the intended account:

```sql
insert into public.admins(user_id)
select id from auth.users where email = 'YOUR_VERIFIED_STAFF_EMAIL'
on conflict do nothing;
```

Optionally seed unpublished drafts with `npx tsx --env-file=.env.local scripts/seed.ts`. Verify rates, room/photo mapping, capacities, schedules, deposits, contact/policies, and the actual QR recipient before publishing. Configure Resend and the authenticated scheduler, then complete the [acceptance matrix](docs/TESTING.md). Environment values being present are not proof of operational services.

Keep `.env.local`, service keys, auth codes, real guest details, private receipts, and signed URLs out of this public repository. The [example environment](.env.example) contains variable names and placeholders only. No software license has been selected. [Screenshots](docs/screenshots/homepage.jpg) illustrate the local design, not live-service verification.
