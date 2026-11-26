# Production security, performance and quality audit — 26 November 2026

Audited the deployed 004 baseline through read-only public requests and browser inspection; fixes below are local changes awaiting migration 005 and deployment. No live payment, guest record, QR or branding setting was changed.

## Security check

- Pass: 11 public/account/admin route pages returned 200. Anonymous /api/admin and /api/bookings returned 401; /api/session returned only configured/user/admin state.
- Pass: scanned those responses and 13 distinct client JavaScript assets (732,123 decoded bytes across routes). Zero service-role JWT / secret Supabase / Resend-key pattern matches; zero expected anon JWT matches. None of the probed matching JavaScript source-map URLs returned a successful JSON/map response. This is scoped pattern-based evidence, not proof that every possible secret format or route is safe.
- Pass: npm audit --omit=dev --json reports zero known vulnerabilities. No package upgrade was needed.
- Source review: privileged Supabase imports are server-only; route checks verify identity/staff membership, SQL repeats permissions, receipts use private storage and scoped signed URLs. PGlite checks exercise guest/admin financial and proof boundaries. Direct authenticated live-provider testing of the new RPCs remains pending.
- Fix prepared: receipt finalization errors preserve uploaded objects, closing a retry path that could erase existing financial proof. Invalid-byte cleanup preserves registered metadata and fails safely on lookup errors; unregistered leftovers remain private pending booking cleanup/operator reconciliation.
- Pass: the local client build also contains zero exact matches for the two locally configured privileged values across 20 static files; values were never printed.
- Fix prepared: API/auth responses explicitly use private, no-store rather than relying on production's observed no-cache header. Added a limited CSP (base/form/object/framing restrictions); script nonces and a full script policy are not implemented. Existing framing/nosniff/referrer/permission protections remain.
- No leaked credential was identified, so no rotation was performed. Public/publishable Supabase keys are allowed in frontend use when RLS/permissions are correct; service, email and scheduler credentials must stay server-side. Developer tools will necessarily show public asset URLs and a user's own temporary upload/download URLs.

## Performance check

- Production single-request HTTP samples: homepage 1,808 ms / 35,932 decoded bytes; stays 1,108 ms / 19,132 bytes; other public pages approximately 591–1,087 ms. These are unthrottled network samples from this machine, not Lighthouse, load-test results, browser LCP/CLS/INP, or a before/after hosting comparison.
- Fix prepared: React request-scoped catalog reuse avoids duplicate layout/metadata/page queries without caching availability across requests. Bundled hero/welcome/card images gain responsive image sizing; hero uses eager/high-priority loading. Owner HTTPS images retain existing direct rendering without opening an unrestricted remote optimizer.
- Pass: local image optimizer returned an 828px hero at 133,234 bytes versus the original 833,933 bytes (84% smaller), HTTP 200. This measures that derivative, not total-page speed.
- Pass: Chrome showed a loaded optimized hero and responsive srcset; original composition remains intact. Full production image-delivery improvement must be measured after deployment. External Google Fonts and dynamic Supabase reads remain performance costs.

## Content and UX quality check

- Production homepage inspected at desktop and 390×844: no horizontal overflow, missing image alt attributes or broken loaded images. No lorem-ipsum/system-check/sample-marker matches appeared in the audited responses. This does not certify every business claim or every interaction.
- Fixed unsupported default food/pet wording to request confirmation from the campsite. Stored owner content is preserved; no rates, reviews, location, contact information or business policies were invented.
- Fixed confusing cumulative-payment workflow, refund balances and combined settings form. Guest QR selection, online-proof fields, separate settings and failed-save recovery were inspected using isolated fictional local fixtures; fixture code was removed before release build.
- Remaining: owner must verify business facts/contact/retention wording already identified in launch documentation. The production mobile Netlify badge can overlap page controls near the viewport bottom; provider branding configuration was not changed. Full WCAG, browser-engine and authenticated production interaction coverage is not claimed.

## Reproduction and limits

Run node scripts/public-audit.mjs and npm audit --omit=dev --json. The audit script prints redacted counts/statuses and never response bodies or token values. See [Testing](TESTING.md) for isolated verification and [Operations](OPERATIONS.md#release-migration-005-and-payment-recovery) for the coordinated release. Independent connection races, actual signed staff-upload transport/expiry, general guest mail and restore remain separate acceptance items.


# Website audit and administration verification — 25 November 2026

Scope: current public website, account/setup states and every admin preview section. Source review included HTTP authorization, SQL/RLS, booking allocation, payment history, promo quotas and migrations. This is a focused implementation audit, not an independent penetration test or full WCAG conformance assessment.

| Finding | Resolution | Evidence / limit |
| --- | --- | --- |
| Header did not identify the active page | Gold underline/strong text, aria-current, matching mobile state; accommodation descendants activate Stay with us | Rendered desktop detail and mobile Camping menu inspected |
| Homepage supporting text competed with photographs | Stronger image shading, white supporting copy/shadows, darker body labels and larger notices | Homepage inspected at desktop, 1024px tablet and 390px mobile; photograph contrast remains image-dependent |
| Dense tablet header could become crowded | Mobile navigation starts at 1100px | 1024px header has no document overflow |
| Information/detail pages shared generic titles | Individual information titles and accommodation names | Production build; representative titles checked after rebuild |
| Overview used the newest 500 client-loaded reservations | Complete database aggregates, explicit period/date basis, transaction ledger | 601-row report fixture reconciles; no fabricated preview performance |
| Basic calendar used UTC date slices and three-column mobile layout | Manila half-open intervals, Monday-aligned month/week grids, mobile agenda and complete range pagination | Month geometry/quarter filter/mobile agenda inspected; interval helper tests cover midnight boundaries |
| Next internal localhost URL rejected valid 127.0.0.1 form submissions | Validate Origin against incoming Host and protocol, still rejecting foreign/malformed origins | Same-origin regression and HTTP smoke; no service writes in preview |
| No in-app staff management | Verified-email promotion and revocation; final-admin protection | SQL authorization, duplicate/unverified account, revocation and last-admin tests pass |
| No discounts/complimentary flow | Transactional promo limits and snapshotted discounts; zero-total staff approval without proof | Rounding, global/customer limits, expiry, snapshots and complimentary approval tests pass |
| Cumulative paid lacked reporting dates and numeric refunds | Append payment deltas and explicitly recorded external refunds; preserve undated opening balances | Retry/refund limits and collections-versus-arrival-value reconciliation pass |
| New report/calendar children could retain old data after workspace refresh | Propagate workspace revision without resetting selected filters | Type/build check plus explicit reload controls; connected browser saves remain staging-only |

## Browser coverage

All public route categories and all ten accommodation details were visited at desktop and 390×844 mobile widths: home, stays, all ten accommodation details, camping, gatherings, about, gallery, FAQ, contact, privacy, account and admin. No horizontal document overflow or missing image alt attributes was detected. Admin overview, reservations, accommodation, content/payment, promo, administrators and email/activity sections were inspected. Period selection changed the displayed quarter; mobile reservation view uses agenda; preview save controls remain disabled. Viewport override was reset afterward.

Screenshots: [homepage](screenshots/homepage-updated.jpg), [desktop active page](screenshots/navigation-updated.jpg), [mobile active menu](screenshots/navigation-mobile-updated.jpg), [dashboard preview](screenshots/dashboard-updated.jpg). Preview screenshots contain no real booking records or financial results.

Solid text colors were strengthened toward readable contrast. Actual photographic copy was visually checked; no blanket WCAG certification, automated image-pixel contrast proof, screen-reader/device matrix, or independent security certification is claimed.

## Remaining operational requirements

Supabase Auth/Storage, SMTP/Resend delivery, real connected admin/guest browser mutations, separate PostgreSQL connection races, hosting and backup restoration still require isolated staging accounts/configuration. PGlite tests serialize queries, so the competing-request test proves behavior under serialized transactions, not independent-connection lock scheduling. Configuration/inventory/email/audit bundles and guest history retain their documented 500-row caps; staff booking/report totals no longer use that cap. Business contact, rates, photo mappings and live booking readiness still require owner verification.
