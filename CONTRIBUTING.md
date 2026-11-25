# Contributing

Read the [developer handbook](docs/README.md), [current handoff](docs/PLAN.md), and applicable reference before editing. Documentation is part of completing a change, not a later cleanup task. Agents follow the same process through [AGENTS.md](AGENTS.md).

## Branch and review workflow

```powershell
git switch main
git pull --ff-only
git switch -c feature/short-description
# Make focused code, documentation, and test changes.
npm run docs:test
npm run docs:check
git add .
git commit -m "Describe the resulting behavior"
git push -u origin feature/short-description
```

Open a pull request to main and complete its template. Run application checks appropriate to the changed behavior; record actual commands/results and limitations. Main requires a PR and the passing **Documentation check**. Independent approving reviews are set to zero so the sole owner can merge their own passing PR. When another developer reviews, they must check documentation accuracy as well as code correctness. Do not bypass the check by changing its policy to evade a relevant update.

After merging, switch to main and pull with `--ff-only`. Stop a local server before switching incompatible database/configuration changes. Keep secrets out of commits, PR bodies, workflow output, and screenshots.

## Documentation impact matrix

The checker considers both old and new paths for renames and deleted code. It requires at least one changed, existing, nonempty reference from each affected row below. A deleted or unchanged document does not count. This deliberately errs toward recording an impact for internal refactors too; update the codebase map or explain the technical change where appropriate rather than adding unrelated text.

| Changed area | Required reference update (at least one listed) |
| --- | --- |
| API handlers, auth callback, validation, shared types | `docs/API.md` or `docs/DATABASE.md` |
| SQL/migrations | `docs/DATABASE.md` |
| Pages, components, CSS and UI assets inside source | `docs/DESIGN.md`, `docs/PROJECT.md`, or `docs/DEVELOPMENT.md` |
| Other application libraries/source | `docs/ARCHITECTURE.md` or `docs/DEVELOPMENT.md` |
| Package/lockfile, env example, Next/TypeScript/Vercel settings | `docs/CONFIGURATION.md`, `docs/OPERATIONS.md`, or `README.md` |
| Scheduled-job handler | API/database reference above **and** `docs/OPERATIONS.md` |
| Scripts and GitHub workflow/configuration | `docs/OPERATIONS.md`, `docs/DEVELOPMENT.md`, or `CONTRIBUTING.md` |
| Tests | `docs/TESTING.md` |

Application, database, configuration, and tooling changes also require a changed [CHANGELOG](CHANGELOG.md). Tests-only changes require their testing reference but no changelog. Markdown-only and shipped/reference-asset-only changes run link checks without requiring unrelated edits. Unknown executable/configuration files are treated as tooling changes rather than silently exempted.

Changing a filename is not proof of an accurate explanation. Review requests/responses, auth rules, failure paths, migration effects, and operational steps against source. Mention configuration/secrets by variable name only. Update PLAN when milestone status changes and create an [ADR](docs/decisions/README.md) for a consequential technical decision.

## Running documentation checks

`npm run docs:check` compares the current working tree (including untracked files) with `origin/main`. Fetch first if your remote reference is stale. On main immediately after a pull there may be no change-impact requirements, but link and inventory checks still run. To check a committed change use `npm run docs:check -- --base REF --head HEAD`. `--three-dot` uses the merge base, as pull requests do. A missing/invalid base is an error, not an automatic pass.

API markers in API.md must exactly cover supported methods/paths discovered from route handlers. Env markers in CONFIGURATION.md must exactly cover `.env.example` keys, and literal runtime `process.env` references must have example entries (except framework `NODE_ENV`). The script parses the current centralized route comparisons with TypeScript's AST; a new dispatcher style needs checker coverage in the same PR. Dynamic/computed endpoints or env access need explicit review rather than an assumption of coverage.

The link check validates local Markdown targets, including images, and permits external URLs without network requests. It ignores fenced/inline code, fragments, and reference-style links; review these manually. It prevents local links escaping the repository. External documentation can change and should be verified when relied upon.

## Definition of done

- User-visible behavior and important failure/retry/permission paths are explained and tested as appropriate.
- Canonical references, environment/API inventories, changelog, and handoff are updated as required.
- Actual validation is recorded; unavailable services are marked Blocked/Not run.
- Documentation check is green, examples use fictional data, and no secrets are included.
- Any migration, release, recovery, and significant architecture consequences are reviewable.
