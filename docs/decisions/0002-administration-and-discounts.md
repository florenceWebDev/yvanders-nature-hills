# ADR 0002: Reporting ledger, equal administrators, and transactional promos

Status: Accepted — 25 November 2026

The owner requested full reporting, customizable discounts including complimentary stays, booking calendars, and administrator management. All administrators may manage other administrators; a separate owner role was declined. Promotion uses an existing verified account, not email invitations.

Use additive migration 002 and keep Supabase/PostgreSQL authoritative. Preserve existing capacity locks behind private base functions; wrappers serialize promo quotas, preserve price snapshots and route complimentary bookings to staff approval. Keep consumed usage after verified payment or complimentary approval. Normalized guest emails consistently enforce per-customer limits for online and staff bookings.

Cumulative paid alone cannot attribute receipts to reporting periods, so append positive payment deltas and explicit externally completed refunds. Preserve unknown historical timing as undated opening entries. Report collections by effective payment date separately from confirmed booking value by arrival date; no accounting profit or earned-revenue claim is made.

Use server aggregates and range pagination instead of the previous 500-booking client bundle. Keep lightweight chart/calendar rendering with exact accessible figures and mobile agenda, avoiding a new dependency. Every mutation remains protected at HTTP and SQL boundaries. Live-service and independent-connection testing remain release requirements.
