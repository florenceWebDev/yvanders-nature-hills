# Deployment handbook

You can ask Codex to **deploy the reviewed PR for you**, or deploy it yourself using the steps below. Both use the existing protected GitHub main branch and Netlify automatic deployment. No command-line deployment credential is required for the manual path.

Repository: [GitHub](https://github.com/florenceWebDev/yvanders-nature-hills). Website: [Yvander’s Nature Hills](https://yvanders-nature-hills.netlify.app/). Hosting: open [Netlify](https://app.netlify.com/) and choose the project matching that website. Database: open [Supabase](https://supabase.com/dashboard) and select the existing production project; verify its URL against the approved release packet before running SQL.

## Choose the release path

| Change | Procedure |
| --- | --- |
| Recognized documentation only | Merge after required checks. An explicitly skipped hosting build is expected when comparison history is available. |
| Application, images, tooling, or dependencies; no database/configuration change | Use the routine checklist below. |
| SQL, permissions, Auth callbacks, environment values, scheduler, or service settings | Use the guided release packet before merging. |

Content, rates, photos, and payment instructions changed through the staff application are saved business settings; they normally do not need a source deployment. Verify the saved result in the application.

## Deploy a routine update yourself

1. Open the prepared pull request on GitHub. Read its **Release packet**. Confirm the intended change, that migrations/configuration say **none**, and that there are no release blockers. If a packet is missing, ask the developer to complete it before merging.
2. Open the PR's checks. Wait for **Application validation** and **Documentation check** to pass on the latest PR revision. For application changes, also confirm the Netlify preview succeeded and inspect the changed pages. Preview services intentionally lack production server/email credentials; do not expect real bookings or email delivery there. If a check fails, leave the PR unmerged and send the failed check name to the developer.
3. Select **Merge pull request** (or the repository's offered merge method), then confirm. Note the resulting main commit. Do not use bypass controls. You do not need to press another deployment button: Netlify starts from main automatically. Main validation runs again; a failure there also requires investigation.
4. In Netlify, select the site's **Deploys** page. Wait for the production deployment to say **Published** or **Live**. Open it and compare its commit with the resulting GitHub main commit. A successful PR preview is a different deployment. If the commit is wrong, or the deployment fails, follow troubleshooting below. Do not repeatedly trigger new builds while one is working.
5. Run the read-only check from the project folder in PowerShell, with Node 22 or newer installed:

   ```powershell
   Set-Location 'C:\Users\USER\Documents\FG\Projects\yvanders-nature-hills'
   npm.cmd run release:check
   ```

   It needs only the repository scripts and Node/npm; no dependency installation, login, or `.env.local` is needed for this command. All checks must say **PASS**, with a final **17/17**. To check a different connected environment, use `node scripts/release-check.mjs https://your-site.example`. Use a bare origin without paths, credentials, or query parameters. Configuration-free previews intentionally fail this production-oriented check; use the existing preview smoke script for them.
6. Open the live website, refresh, and check the changed screen and its important interaction. If layout changed, check a narrow/mobile view too. For account/staff work, use your existing session and the release-specific checks. Do not create real payments or delete reservations as test fixtures. Record the commit, HTTP result, affected-screen result, and remaining limits in the release handoff.

For documentation-only merges, steps 4–6 are unnecessary when hosting explicitly reports a documentation skip and no application release is pending. The public site's commit may then remain older than main. If history is unavailable, a normal build is expected. A skipped build never proves an earlier failed application release has been published: resolve that failure first. Never merge unrelated changes during a coordinated database transition.

## Ask Codex to deploy

Example: “Deploy PR #NUMBER using the deployment handbook.” Codex handles the applicable checklist and reports the published commit and observed verification. Existing authorization covers routine steps in the requested release; additional consequential actions outside that scope must be identified before execution.

- Use GitHub connectors and available provider APIs/CLIs for status, merge, and logs. Use browser access when the required provider operation is unavailable through those tools, and for the changed rendered layouts/interactions. Do not install a new credential workflow merely to deploy.
- Check the current session/tool availability once. Reuse successful checks for an unchanged commit and context; repeat affected checks after changes, failures, or stale evidence. A local build, CI build, and hosted adapter build establish different things and are not interchangeable.
- Poll compact status about every 30 seconds while a build is active; retrieve relevant logs after failure. After ten minutes without completion, inspect the queue/build state rather than retrying or merging something else. Continue monitoring the same deployment if it is still progressing. Report meaningful changes, failures, or needed owner actions.
- Run the HTTP check once after the correct deployment is live, then the affected interaction checks. A failed check needs diagnosis and an affected recheck. The broader public asset audit is available for security/asset changes; it is not required for every routine update.
- Record timing where available: CI/build start and finish, total release elapsed time, and number/purpose of browser operations. Keep summaries free of secrets and user data. These timings are operational observations, not AI billing measurements.

An owner doing the manual steps does not need AI to operate their browser. Assisted deployment still uses AI, and sign-in, provider queues, builds, and consequential database work can take time. No percentage saving or fixed completion time is promised.

## Guided database or configuration release

These releases need a developer-prepared packet specific to the PR. The owner can execute it, or ask Codex to execute it within the authorized scope. **Do not merge first:** main automatically deploys, and an incompatible database may break the application.

Before starting, the packet must contain:

- The reviewed PR revision, previous published commit, correct production project/site, installed migration baseline, exact new migration filenames/order, configuration changes, and compatibility with old code and open browser sessions. The current recorded baseline is migrations 001–006; verify actual state before a future release. Initial migrations were installed through SQL Editor, which does not establish CLI migration-history entries.
- Isolated rehearsal results; safe prechecks and expected results; approved independent backup location/restore evidence; and a recovery procedure that preserves new business records. Private backups/SQL outputs stay outside this public repository. Existing same-database snapshots are recovery aids, not independent backups. If a prerequisite is missing, resolve it or document a specifically approved exception before starting.
- Exact pause/resume operations if compatibility requires them, who stops staff activity, the previous readiness/job/grant states to restore, and the failure branch for every committed step. Use the appropriate provider API such as `cron.alter_job` for scheduler state; direct `cron.job` updates were denied in the prior release. Do not guess grant statements or pause every release by default.
- Exact reviewed SQL and settings to apply, expected postchecks for permissions/function signatures and preservation of records, when to merge, how to identify the matching hosted commit, authenticated checks, and when to resume. Record schema-only/config-only changes explicitly rather than assuming a code rollback undoes them.

Execute only the packet's ordered steps against the verified target. Apply each new migration once. For SQL Editor, compare the entire selected text against the reviewed file before execution. If any expected result differs, stop and follow the prepared recovery branch; do not repeatedly run migrations, overwrite financial records, or resume incompatible code/worker operations. After publication and checks, restore the captured operational state rather than blindly enabling everything. Refresh affected staff/guest clients and record what passed or remains blocked.

The migration-specific procedures in [Operations](OPERATIONS.md#release-migration-006-and-booking-recovery) explain earlier compatibility constraints; they are not scripts to rerun on the current database. Follow the [release readiness requirements](RELEASE.md) for real booking operation. SMTP, independent contention, and restore gaps remain separate acceptance work.

## If something goes wrong

| Situation | What to do |
| --- | --- |
| GitHub check failed | Leave PR unmerged; open that check, capture the failed step without secrets, and have the developer fix/recheck it. |
| Netlify build failed | The older published deployment may still be serving. Inspect the failed build and main checks; fix through a PR or retry once after a diagnosed transient failure. Do not claim the new version is live. |
| No new deploy / older commit | Check the main commit, linked branch, publishing state, and ignore result. Docs-only skips are expected. For a pending app/configuration release, resolve the failed/stopped build and explicitly trigger a new main build in Netlify. A same-commit rebuild continues even if there are no source changes. |
| HTTP check fails | Confirm the target and commit; inspect failed paths and service configuration. A timeout can be connectivity-related. Diagnose and rerun affected checks; do not log response bodies or session material. |
| Need application rollback | Confirm database compatibility first. In Netlify Deploys, publish the known-good deployment. Pause automatic publishing if necessary to prevent replacement; reconcile source through a protected revert PR and restore publishing afterward. Confirm the rollback commit and rerun checks. |
| Migration committed / configuration changed | Keep incompatible operations paused and use the packet's reviewed forward fix or compatible database/app recovery. Application rollback does not reverse SQL, business records, uploads, or sent email. |
| Login/permission prompt | Use the intended owner's account. Owner sign-in or a required authorization may be needed; do not grant unrelated permissions or share codes/secrets in evidence. |

## Why this process changes

The recorded PR #10 Netlify deploy took 29 seconds. The release history also records OAuth/profile access, SQL-editor comparisons, backup limitations, coordinated pauses, permission checks, and rendered verification. Those records suggest coordination overhead beyond hosting time; they do not measure total release time or AI-credit consumption. Existing HTTP scripts also serve different purposes: preview smoke assumes a sample listing, while the broad public audit reports observations rather than enforcing a release gate. The new check provides an anonymous production gate without those assumptions.

Netlify now uses [its documented ignore-command semantics](https://docs.netlify.com/build/configure-builds/ignore-builds/): exit 0 skips, exit 1 builds. The dependency-free script compares Netlify's [CACHED_COMMIT_REF and COMMIT_REF](https://docs.netlify.com/build/configure-builds/environment-variables/#git-metadata), checks ancestry and checkout identity, and skips only root README/AGENTS/CONTRIBUTING/CHANGELOG Markdown or Markdown under docs. Renames include both paths. Assets, SQL, scripts, configuration, unknown paths, empty comparisons, and unavailable history build normally. Cached refs describe build history, not proof of successful publication. Build hooks bypass the ignore command; same-commit or cache-cleared rebuilds also continue. Environment/service changes always need an explicit rebuild where applicable.

GitHub still runs Application and Documentation on PRs and main without path filters. Only superseded PR runs are cancelled; main/manual runs have unique concurrency groups. Hosting preview, CI, and production publishing remain distinct. See [ADR 0009](decisions/0009-efficient-deployment.md) and [Testing](TESTING.md) for validation and limitations.
