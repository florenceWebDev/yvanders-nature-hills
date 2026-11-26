# ADR 0009: Efficient assisted and owner-operated deployment

Date: 26 November 2026. Status: Accepted for implementation; hosted behavior awaits the feature PR and release.

## Context

The owner wants faster deployment with fewer AI browser operations and an easy manual alternative. Netlify already deploys protected main; database migrations use a separate operator procedure. Historical instructions combine initial setup, Vercel candidates and live Netlify releases. Recorded hosting time alone does not establish total deployment time or AI cost.

## Decision

Keep GitHub → Netlify continuous deployment, branch protections, existing services, and operator-reviewed SQL. Use one [deployment handbook](../DEPLOYMENT.md) for assisted or manual release. Scripts/connectors handle routine status and read-only HTTP checks; browser checks follow affected UI behavior and dashboard-only operations. Migration/configuration releases require a specific compatibility/recovery packet before merge.

Add an anonymous production HTTP gate, conservative documentation-only Netlify build skipping, and cancellation of superseded PR checks. Main checks continue independently. Uncertain history and unknown paths build. No new deployment token, database migration automation, or production secret is introduced. Provider-defined build metadata is not application runtime configuration.

## Consequences

Routine releases need less repeated dashboard interaction. Documentation-only hosting builds can be avoided, while required GitHub checks remain. Actual savings require measurement. The HTTP gate does not prove the published commit, authenticated permissions, storage, email delivery, or independent restore; these need separate evidence. Explicit rebuilds remain necessary for environment changes or unresolved publication failures. Historical migration records remain intact, clearly separated from current instructions.
