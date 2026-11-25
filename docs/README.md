# Developer handbook

Start with the project [README](../README.md), then follow this reading order. This handbook describes the checked-in implementation; provider setup and live verification have separate status.

| Read | What it answers | Update when |
| --- | --- | --- |
| [Development](DEVELOPMENT.md) | Where is the code? How do I run it and add a feature? | Responsibilities, workflows, commands, or conventions change |
| [Architecture](ARCHITECTURE.md) | What runs where, and which operations are trusted? | Boundaries, data flow, or technical decisions change |
| [API](API.md) | What endpoints exist, who can call them, and what do they accept? | Routes, validation, request/response contracts, or authorization change |
| [Database](DATABASE.md) | How do records, booking states, permissions, and transactions work? | SQL, state transitions, allocations, or migrations change |
| [Configuration](CONFIGURATION.md) | Which environment values and provider settings are needed? | Runtime configuration or account setup changes |
| [Operations](OPERATIONS.md) | How do I deploy, troubleshoot, retry, and recover? | Hosting, scheduled jobs, recovery, or support procedures change |
| [Testing](TESTING.md) | What is tested, what actually passed, and what is unverified? | Test procedures or observed results change |
| [Design](DESIGN.md) | What visual patterns and accessibility conventions should I preserve? | User interface and interaction patterns change |
| [Project brief](PROJECT.md) | Which business requirements and acceptance criteria are agreed? | Product scope or business rules change |
| [Current handoff](PLAN.md) | What is complete, blocked, and next? | Milestone status changes |
| [Release](RELEASE.md) | Is the application ready for a real release? | Release readiness or deployment evidence changes |
| [Decisions](decisions/README.md) | Why was a significant technical choice made? | A consequential choice is accepted or superseded |
| [Changelog](../CHANGELOG.md) | What changed for developers, operators, or users? | Application, configuration, or database changes |
| [Contribution rules](../CONTRIBUTING.md) | What must be updated and checked before merging? | The development and review process changes |

## Sources of truth

The SQL migration defines persisted fields, database permissions, and transactional rules. TypeScript validation defines HTTP input contracts. Handwritten types assist the UI but are not the authority for nullable database fields. References link to these files rather than duplicating every implementation line.

Requirements belong in PROJECT; technical facts in the technical references; observed evidence in TESTING; current work in PLAN. IMPLEMENTATION-BRIEF preserves the original agreement and should not become a competing live specification. SKILLS records tooling available during development, not application dependencies.

## Keeping this useful

Read [CONTRIBUTING](../CONTRIBUTING.md) before editing. Update the affected reference in the same pull request as the code. A passing check proves mechanical coverage and change presence, not that prose is accurate. Review explanations, examples, and failure cases against the implementation.

Never put real credentials, payment screenshots, guest details, session cookies, or signed URLs in this public repository. Use fictional examples and redact operational evidence.
