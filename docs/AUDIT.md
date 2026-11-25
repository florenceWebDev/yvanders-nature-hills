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
