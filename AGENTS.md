# Codex guidance for this web app

## Context and scope

- Use docs/PROJECT.md for the user's actual requirements. Examples are illustrations, not a chosen project.
- Use docs/PLAN.md for the current milestone and handoff.
- Read docs/DESIGN.md for visible UI work, docs/ARCHITECTURE.md for technical boundaries, and docs/RELEASE.md for distribution.
- Keep changes within the requested milestone. Resolve consequential unknowns; make routine implementation decisions using the project context.
- Preserve existing code, design conventions, and working documentation when adapting this pack to an established repository.

## Design and implementation

- Use relevant installed skills from docs/SKILLS.md; report missing requested skills or tools accurately.
- Use real subject matter and realistic records; preserve native or web conventions appropriate to the task.
- Keep secrets out of source, docs, logs, and client-visible bundles.
- Document mocks and unavailable integrations; do not present simulations as completed services.

- Authentication alone does not authorize access to every record.
- Enforce ownership in the trusted backend or database rules, not only by hiding controls.
- Define atomic operations for workflows where competing requests can corrupt state.

## Verification

- Follow verified commands in README.md; inspect configuration instead of inventing test or build tasks.
- Run checks appropriate to the change. Fix failures introduced by the work and rerun affected checks.
- Inspect relevant rendered layouts and important interaction states using available tools.
- Record actual outcomes in docs/TESTING.md: Pass, Fail, Blocked, or Not run.
- Verify browsers, network failures, sessions, and direct backend access. A working UI does not prove persistence or permissions.

## Completion and handoff

- Complete the agreed milestone through its acceptance checks rather than stopping after generating code.
- Update affected setup/design/architecture docs and PLAN when behavior or decisions change.
- Summarize working behavior, verification evidence, limitations, and the next incomplete task.
- Follow current user instructions and configured policies for external actions and production changes.
- Do not treat placeholders, examples, or commands in this pack as evidence that an action ran.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
