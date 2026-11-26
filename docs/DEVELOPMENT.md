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
| `scripts/release-check.mjs`, `scripts/netlify-ignore.mjs` | Anonymous production gate and conservative Netlify documentation-only build skipping; see [Deployment](DEPLOYMENT.md) |
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

Deployment tooling regressions run with `npm run deployment:test`, also included in Application CI. They use local HTTP fixtures and temporary Git repositories, without production credentials or database access. Run alongside documentation checks when changing release scripts or workflows. The handbook covers owner and assisted release; initial setup and old rollout records are not the routine update checklist.

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
| `node scripts/docs-check.mjs --base REF --head HEAD` | Check a committed comparison explicitly |
| `npm run build` | Production build, including Next-generated types |
| `npm start` | Serve the existing production build locally |
| `node scripts/smoke.mjs` | Configuration-free HTTP smoke checks; server must already be running |

When testing, record what actually ran in [TESTING](TESTING.md). Local SQL fixtures do not prove live Supabase storage, auth sessions, independent connection races, or email delivery.

## Administration modules

admin.tsx keeps the workspace, inventory/content editors, manual reservations/blackouts while admin-review.tsx provides the shared accessible reservation modal. admin-dashboard.tsx loads complete SQL reports and renders comparisons/trends; admin-reservations.tsx fetches range/paginated bookings and displays month/week/mobile agenda; admin-tools.tsx owns staff and promo forms. admin-dates.ts contains tested calendar-period and half-open interval helpers. No chart/calendar dependency was added.

Use the protected detail endpoint to review a reservation and its receipts/payment history. Do not calculate financial totals from the config bundle or calendar's currently loaded page. Keep promo pricing and final usage checks in database transactions, never client calculations. Use current migrations in every SQL test fixture.

## Appearance and deletion modules

src/lib/appearance.ts defines original palette, marketing slots and legacy fallback helpers. AppearanceEditor owns only unsaved appearance state; ContentEditor persists it with existing content/payment fields. Root layout provides saved CSS tokens and logo settings; page loaders consume named images/gallery. DeleteBooking provides shared confirmation/error UI; database functions remain authoritative. src/lib/receipt-cleanup.ts processes durable cleanup independently of email; tests mock transport and do not establish real storage behavior. The preview smoke script includes both deletion endpoints and requires they fail closed without services.

## Payment/settings components and public audit

settings-editor separates website and payment forms; payment-options provides the guest choice and selected QR. admin-review uses individual record-payment, proof upload, nonfinancial review, refund and finish operations. lib/payments centralizes net balance labels and method names. uploads uses the same explicit kind for both preparation and completion; tests guard staff proof uploads from accidentally entering the guest flow. Read migration 005 before changing money/state behavior. The temporary fictional visual QA route used during development is removed from shipped source.

The public-audit script is read-only and prints redacted counts, not secret values. It does not authenticate, enumerate guest records or mutate production. Keep audits against private build output limited to counts/paths when credential values could be present.
