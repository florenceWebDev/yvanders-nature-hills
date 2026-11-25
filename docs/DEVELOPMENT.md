# Development guide

## First session

Use Node 22 LTS or newer, npm, and Git. From a fresh clone, run `npm ci`, then `npm run dev`. Open http://127.0.0.1:3000 and stop with Ctrl+C. See [configuration modes](CONFIGURATION.md) before connecting any provider. Preview mode requires no secrets and cannot create real bookings.

Read [PROJECT](PROJECT.md), [PLAN](PLAN.md), and the [handbook index](README.md). Verify the working tree before changing it; preserve unrelated work. Use a feature branch and the [pull-request process](../CONTRIBUTING.md).

## Codebase map

| Location | Responsibility |
| --- | --- |
| `src/app/layout.tsx` | Shared header/footer, global styles, metadata, dynamic rendering |
| `src/app/page.tsx` | Marketing homepage |
| `src/app/[page]/page.tsx` | Allowlisted camping, gatherings, about, gallery, FAQ, contact, and privacy pages |
| `src/app/stays/` | Catalog and per-offering detail pages |
| `src/app/account/`, `src/app/admin/` | Guest and staff page entrypoints |
| `src/app/api/[...path]/route.ts` | Central GET/POST dispatcher for app operations; unknown paths return 404 |
| `src/app/api/jobs/route.ts` | Authenticated email-queue and hold-expiry job |
| `src/app/auth/callback/route.ts` | Auth-code exchange and allowlisted redirect |
| `src/components/` | Client forms, account/admin workflows, cards, navigation, and search |
| `src/lib/catalog.ts` | Preview listings, default content, PHP/time formatting helpers |
| `src/lib/data.ts` | Server-only public catalog loading; uses published records when configured |
| `src/lib/supabase.ts` | Server-only cookie-aware client, service-role client, verified-user/admin checks |
| `src/lib/validation.ts` | Zod request schemas, safe image URL checks, image signature checks |
| `src/lib/uploads.ts` | Browser direct signed-upload sequence; original file bytes are preserved |
| `src/lib/types.ts` | UI-oriented shared types; compare nullable fields with SQL |
| `supabase/migrations/` | Schema, RLS, functions, storage buckets, transactional booking rules |
| `scripts/seed.ts` | Optional unpublished draft inventory; never promotes an admin |
| `scripts/smoke.mjs` | HTTP checks against a running configuration-free preview |
| `scripts/docs-check.mjs` | Documentation links, inventories, and change-impact checks |
| `tests/` | Application validation/database tests and documentation-check regression tests |
| `public/images/` | Shipped campsite photos |
| `assets/references/` | Original supplied assets and reference provenance |

Next.js route parameters are asynchronous in this app. The installed Next.js package contains matching documentation under `node_modules/next/dist/docs/`; read it before changing framework behavior. Do not manually maintain generated `next-env.d.ts` or commit `.next` output.

## Follow one booking

1. A server page loads the public catalog. Without Supabase configuration, it returns clearly labeled sample listings. A configured catalog error returns an unavailable state rather than fabricated availability.
2. Listings carry selected dates/party size to an offering detail page. The client booking form checks session and requests a quote.
3. The hold endpoint checks required service configuration and verified identity, then calls the transactional database hold function. The database calculates price, locks allocation resources, and returns the booking reference and expiry.
4. The guest account page displays the snapshotted QR/payment instructions. The original screenshot goes directly to a scoped storage URL. The server validates the uploaded bytes before finalizing the receipt.
5. The admin reviews actual receipt of funds and makes a decision. Database state and email outbox entries commit together. A separately authenticated job delivers queued mail.

See [API](API.md) for HTTP contracts and [Database](DATABASE.md) for the full state machine. A screenshot is not payment verification, and the UI is not the authorization boundary.

## Common changes

### Add an offering using existing capabilities

For content only, use the configured admin editor: choose room/camping/pavilion/day-use, rates, deposit, resource pool, capacity, schedule, and images. Review drafts before publication. Do not add inventory to `sampleOfferings` as a substitute for a real database record. Each numbered pitch can have an exclusive capacity-one resource; shared quotas can use a shared resource pool.

### Add a new offering behavior

Trace the shared type, Zod schema, admin editor, guest form, SQL constraints/calculation, and public display together. Introduce an additive migration for an existing database. Test price, capacity, scheduling, and guest/admin boundaries; update DATABASE, API, and applicable design/requirements docs.

### Change booking behavior

Start with the SQL state transition and allocation invariant, then trace its endpoint and client states. Preserve booking snapshots and retry/idempotency behavior. Add tests that demonstrate the business rule, including denied and conflicting requests. Record migration and rollback implications.

### Add an endpoint

Follow the existing dispatcher or add a standard App Router route handler. Validate input, enforce verified-user/admin checks as needed, and keep service-role operations on the server. Preserve same-origin POST protection. Add an API section and endpoint marker, test success/denial/error behavior, and run the documentation checker.

## Commands

| Command | Purpose |
| --- | --- |
| `npm ci` | Install the lockfile dependency set |
| `npm run dev` | Local development server |
| `npm run typecheck` | TypeScript checks; generate Next types with dev/build first in a fresh clone |
| `npm test` | Existing application validation and PGlite SQL tests |
| `npm run docs:test` | Documentation-check regression tests, independent of providers |
| `npm run docs:check` | Documentation checks against `origin/main`, including tracked working changes and untracked files |
| `npm run docs:check -- --base REF --head HEAD` | Check a committed comparison explicitly |
| `npm run build` | Production build, including Next-generated types |
| `npm start` | Serve the existing production build locally |
| `node scripts/smoke.mjs` | Configuration-free HTTP smoke checks; server must already be running |

When testing, record what actually ran in [TESTING](TESTING.md). Local SQL fixtures do not prove live Supabase storage, auth sessions, independent connection races, or email delivery.
