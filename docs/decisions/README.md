# Architecture decisions

Use a short architecture decision record (ADR) for consequential choices: changing database/hosting/auth providers, altering payment trust boundaries, replacing allocation strategy, or introducing a substantial integration. Routine styling and bug fixes belong in the changelog and relevant reference.

Create the next numbered file, describe the actual decision and tradeoff, and link it from the architecture guide. Accepted decisions remain as history. A replacement marks the old record superseded and links both directions; do not silently rewrite historical reasoning.

## Index

- [0001 — Application baseline](0001-application-baseline.md)
- [0003 — Temporary Netlify client preview](0003-temporary-netlify-preview.md)
- [0004 — Connected Netlify services](0004-connected-netlify-services.md)
- [0005 — Configurable payment options](0005-configurable-payment-options.md)

- [0006 — Appearance settings and permanent deletion](0006-appearance-and-permanent-deletion.md)

## New-record template

```text
# NNNN — Short decision title
Date: YYYY-MM-DD
Status: Proposed | Accepted | Superseded by NNNN

## Context
Concrete problem, constraints, and relevant existing behavior.

## Decision
Chosen approach and its boundaries; link to source/reference docs.

## Alternatives and consequences
Meaningful alternatives considered, benefits, costs, and operational effects.

## Verification and follow-up
What has been demonstrated and what remains unverified.
```
