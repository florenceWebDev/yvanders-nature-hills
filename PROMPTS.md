# Prompts for your web app

Copy one block at a time into Codex. These are chat prompts, not terminal commands. Replace bracketed details and use the actual project brief; examples are not requirements. Implementation prompts must be used in a mode that permits edits.

## 1. Start and plan

```text
I am starting a web app using this starter pack.
Read AGENTS.md, docs/PROJECT.md, and docs/PLAN.md.
Inspect the workspace and any existing application before making changes.

First, help me complete the Start here fields in PROJECT.
Use my actual answers; the examples in the pack are not requirements.
Recommend options for unknown choices and ask only questions that
materially affect scope, design, data, tooling, or release.

Check available skills against docs/SKILLS.md and identify missing tools.
Read docs/DESIGN.md and assets/references/README.md for visual context.
Propose an approach and milestones, including one representative screen
and one complete journey: interface, real storage/integration where needed,
permissions, failure recovery, and observable acceptance criteria.

Explain the decisions and the proposed planning-document updates.
If this session is in Plan mode, propose changes without writing files.
Otherwise, save the agreed planning changes in the relevant documents.
Do not scaffold application code during this planning step.
Tell me the next concrete step once the plan is ready.
```

## 2. Choose the visual direction

```text
Read docs/PROJECT.md, docs/DESIGN.md, and my reference notes.
Use the selected design/platform guidance that is actually available.
Propose two visual directions appropriate to this audience and task.
Explain typography, hierarchy, layout, content, imagery, and interaction.
Recommend one; preserve familiar platform controls and accessibility.
Record the chosen direction in DESIGN after my selection.
Do not invent endorsements, statistics, or business facts.
```

## 3. Implement the representative screen

```text
Implement the representative screen agreed in docs/PLAN.md.
Read the relevant design and platform guidance first.
Use realistic content and actual assets; identify temporary data clearly.
Inspect the rendered result at relevant sizes/platform settings.
Check important UI states, text fitting, navigation, and accessibility.
Record the implemented tokens/components in DESIGN.
Report what is verified and what still needs the real backend or device.
```

## 4. Complete the first functional milestone

```text
Implement the current milestone in docs/PLAN.md using PROJECT's actual
acceptance criteria and relevant ARCHITECTURE decisions.
Use matching installed framework/database/platform skills.
Complete the journey through real persistence/integration where needed,
trusted permissions, validation, failures, and reload/relaunch behavior.
Do not stop at disconnected screens or permanently simulated success.
Run appropriate checks, inspect the result, and fix issues caused by
this milestone. Record evidence in TESTING and actual commands in README.
Update PLAN and report remaining limitations and the next task.
```

Suggested shape to adapt: One complete user journey with actual persistence/integrations and access rules where required.

## 5. Critique and refine the design

```text
Critique [screen or flow] against DESIGN and the real audience/task.
Identify the highest-impact issues in hierarchy, content, spacing,
typography, visual consistency, accessibility, and interactions.
Explain which decisions feel generic or unrelated to this product.
Recommend specific changes before broad redesign; preserve the chosen
direction and working behavior. Implement the agreed changes and
inspect their rendered result with available tools.
```

## 6. Verify behavior and security boundaries

```text
Verify the current milestone against PROJECT and TESTING.
Exercise success, invalid input, failure recovery, persistence, and
relevant access/concurrency/platform scenarios.
Perform an explicit security review using matching guidance; use the
security-best-practices skill only for its supported languages.
Where threat modeling is needed, identify actual trust boundaries and
realistic abuse paths rather than generating a generic checklist.
Record commands, environment/build, observed results, and limitations.
Fix issues within scope and rerun affected checks.
```

Platform reminder: Verify browsers, network failures, sessions, and direct backend access. A working UI does not prove persistence or permissions.

## 7. Report and fix a specific problem

```text
Environment/build: [browser, device, OS, revision]
Screen or operation: [name]
Steps to reproduce: [smallest sequence]
Actual behavior: [what happens]
Expected behavior: [acceptance criterion]
Evidence: [error, screenshot, log, or test]
Preserve: [working behavior and chosen design]
Investigate the cause, implement the scoped fix, and verify the same
scenario plus relevant regressions. Update affected docs.
```

## 8. Continue the next milestone

```text
Read the current handoff in PLAN and results in TESTING.
Confirm the previous milestone's actual completion state.
Implement the next agreed milestone, preserving established patterns.
Keep new feature requests in PROJECT's Later section unless explicitly
added to scope. Verify the changed behavior and update the handoff.
```

## 9. Prepare a release

```text
Read RELEASE, PROJECT, and TESTING. Check the actual build and
distribution configuration, unfinished acceptance criteria, required
access, and recovery plan. Prepare a concrete release procedure.
Complete safe preparation and checks within the authorized scope.
Follow current instructions and configured policy for external actions.
Verify the deployed/signed result when distribution is authorized and
possible. Record evidence, missing access, and remaining limitations.
```

## 10. Resume in a new chat

```text
Read AGENTS.md, docs/PROJECT.md, and docs/PLAN.md.
Inspect relevant code and docs/TESTING.md, then summarize the milestone.
Treat unverified results and examples accurately. Continue the next
incomplete agreed task; resolve any blocking decision first.
Update the handoff before finishing.
```

## 11. Update the brief after a scope change

```text
The requirement changed to: [new requirement].
Identify its effect on PROJECT, DESIGN, ARCHITECTURE, PLAN, TESTING,
and RELEASE. Update the relevant decisions without copying conflicting
versions. Explain migration or compatibility implications before
changing existing data or production behavior.
```
