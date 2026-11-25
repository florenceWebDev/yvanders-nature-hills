# Changelog

Record application, configuration, database, and tooling changes under Unreleased in the same PR. Move reviewed entries into a dated version section when an actual release is made. A package version or GitHub push alone does not mean a hosted production release occurred.

## Unreleased

### Documentation and tooling

- Added a developer handbook with codebase map, walkthroughs, API/database references, configuration, operations, and architecture decisions.
- Added documentation link, endpoint/env inventory, and change-impact checks with regression coverage and a GitHub Actions job.
- Added contribution and PR rules requiring documentation with code; main-branch enforcement is configured and verified as part of the documentation rollout evidence.

### Initial application baseline

- Public promotional and accommodation pages, guest accounts/history, QR-payment proof workflow, admin booking/inventory/content management, and email outbox implemented.
- PostgreSQL owns price, allocation, booking transitions, role checks, and transactional email creation; receipts are private and finalized after server inspection.
- Local project setup and public GitHub source publication completed. Live provider setup, real email delivery, hosting, and restore verification remain pending.
