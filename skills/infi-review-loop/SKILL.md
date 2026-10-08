---
name: infi-review-loop
description: Coordinate independent reviews and proportional fix rounds for a scope-settled branch or PR. Own release guarantees, authorization, finding status, and stopping rules while composing infi-code-review, infi-fix-planning, and relevant testing tracks. Use for review-and-fix loops, hardening a branch, or polishing a PR until its agreed release guarantees are verified.
---

# Review loop

Bring the agreed release guarantees to a verified state while keeping future
changes easy. You own scope, decisions, finding status, and stopping rules.
Use `infi-code-review` to establish findings and `infi-fix-planning` to compare,
implement, and verify corrections. Optional testing and quality tracks provide
additional evidence. Finding counts and shrinking diffs are not success criteria.

Read [the shared review contract](../infi-code-review/references/review-contract.md)
before calibration. Read the relevant entrypoint when dispatching
[code review](../infi-code-review/SKILL.md),
[fix planning](../infi-fix-planning/SKILL.md), or
[exploratory testing](../infi-exploratory-testing/SKILL.md).
The shared contract owns risk, dispositions, recurrence, and closure; the fix
skill owns solution comparison and implementation mechanics. Do not recreate
those procedures inside the loop.

## Keep coordination and execution separate

The orchestrator holds the release contract, finding summaries, decisions,
coverage, and command results. Track agents handle reviews and one fix round;
their workers inspect code, implement plans, or verify closure. Delegate
substantial inspection, while reading a bounded excerpt yourself when needed
to judge a handoff. Return full evidence in assigned artifacts and short
outcomes in messages.

Establish actual concurrent-agent capacity before dispatch:

- Run tracks in parallel only when there is room for their orchestrators and
  all planned workers. Otherwise run tracks sequentially, giving the active
  track the available worker budget. Apply the same budget to fix planning.
- Combine compatible review lenses into fewer fresh reviewers when constrained.
  Do not resume a completed reviewer as an independent new lens, or spawn a
  closure verifier inside the fixer thread.
- Give workers an artifact path and meaningful checkpoints. One reminder for
  a missed checkpoint, then interrupt and assess partial evidence. An
  incomplete artifact is a coverage gap; do not let it stall every track.
- If an interrupted worker still occupies a slot, reduce the available budget.
  Continue where independent work is possible; otherwise report the capacity
  gap. Never treat a reused context as a fresh reviewer to hide the shortfall.

Review steps and source mutations never overlap. Plan-only workers are also
read-only. Fixers with overlapping files or shared lifecycle ownership are
serialized or assigned an explicit integration owner by fix planning.

## Keep one owner for records

- `<run-root>/review-loop/<date>-<slug>/loop.md` records the release contract,
  scheduling, decisions, and round outcomes. Use the project's gitignored
  scratch directory (`.context/` when available), otherwise `.review-loop/`.
- Allocate one tracked `findings/CR<N>.md` for the run and one `ET<N>.md` when
  exploratory testing is selected, with numbers above the highest existing
  suffix. Respect the project's alternative findings directory.
- You alone own current status in those CR/ET records. `loop.md` links to their
  finding inventory instead of maintaining another status table. Put static,
  quality, and docs findings in CR; preserve ET findings in ET and cross-link
  duplicates instead of creating two live status entries for one issue.
- Inner skills write only their assigned untracked `ROUND-<n>` artifacts during
  reviews/planning. Fix execution may edit the authorized implementation files,
  but never CR/ET/FIXES records, and never commits. Do not create a competing
  standalone FIXES ledger inside a loop.
- When continuing previous standalone work, import IDs, decisions, and evidence
  and link the old ledger to its new owner under the shared contract. Preserve
  historical reports and dispositions.

## Establish scope and reuse existing authorization

Calibrate from files and commands, then record the following in `loop.md`:

1. **Base and candidate:** explicit user/workspace base, then actual PR base,
   then repository default. Record exact hashes and relevant uncommitted content
   as a reproducible snapshot; a HEAD hash alone does not identify dirty work.
2. **Project rules and gates:** read applicable instructions and discover exact
   static checks plus required integration, end-to-end, visual, installed-package,
   or manual checks from project guides and CI. Record which changed surfaces
   require each tier. Follow project rules for starting services.
3. **Release guarantees:** supported workflows, observable promises, fixed
   product/design decisions, known limitations, and the boundary fixes may not
   cross. Distinguish documented commitments from inferred assumptions. Note
   user maintenance preferences and unresolved support or trust-policy choices.
4. **Tracks and capacity:** selected tracks and reasons, worker budgets, and
   whether any optional cleanup has a demonstrated purpose (see below).
5. **Authorization:** existing decisions, autonomy policy, and commit policy.
   Do not reinterpret permission to review as permission to implement, change
   product behavior, publish, or accept a live defect.
6. **Verification and stopping:** checks for each release guarantee, residual
   acceptance policy, coverage limits, and round budget. Defaults are five
   correctness rounds plus two optional finishing rounds when selected.

Present the scope and any material assumptions in plain language. Reuse the
user's established scope and authorization; do not request confirmation again
because a new skill or phase began. Read-only review may proceed while a
product choice remains open. Ask only for missing decisions before dependent
implementation, showing concrete alternatives and their consequences. Existing
explicit instructions take precedence over the defaults below.

Autonomy policies:

- **checkpoint** (default): present the concrete fix sheet after review and
  obtain decisions not already authorized before implementation.
- **guided:** implement mechanical plans within the agreed guarantees; present
  unresolved product/architecture tradeoffs before their dependent work.
- **autonomous:** implement within the agreed guarantees and accepted tradeoffs.
  Log new optional judgment proposals as follow-ups. A live blocker needing an
  unauthorized tradeoff remains unresolved; it cannot be silently deferred or
  called accepted. Present the concrete decision when needed.

Allocate the run records when the review scope is established. Run the required
verification plan as a baseline before source mutations, recording exact results.
A red baseline is evidence and may prevent release readiness; it is not
permission to narrow the checks or expand the fix scope.

## Use cleanup only when it earns its cost

Skip ROUND-0 by default. A long file/function is a reason to inspect its
structure, not automatic permission to split it. Optional cleanup belongs in
the plan when demonstrated dead code or an existing seam makes review or
ordinary changes materially easier. Explain the benefit and likely regression
surface; observe existing authorization for that work.

Use fix planning in plan and execute modes for accepted cleanup, just as for
other changes. Keep it behavior-preserving and separately attributable. Never
move an oversized implementation behind a facade merely to meet a line limit.
If no useful safe extraction exists, leave it intact and record any concrete
maintenance concern. Revert an isolated cleanup that introduces failures when
safe; do not spend the correctness budget expanding optional cleanup.

## Select evidence tracks

| Track | Purpose | Execution |
| --- | --- | --- |
| `static` | Project gates and required automated verification | Exact project commands, inline or one worker |
| `code-review` | Defects and demonstrated maintenance costs | `infi-code-review` in loop mode |
| `exploratory` | Real user flows and app behavior | `infi-exploratory-testing` in loop mode when the app can be driven |
| `quality` | Optional naming, boundary, and simplification proposals | Read-only reviewer; require concrete future-change benefit and tradeoffs |
| `docs` | Factual drift in descriptions of changed behavior | Read-only reviewer across relevant docs, marketing, in-app text, translations, and comments |

Maintenance is evaluated from the first review and during every fix plan and
closure. Optional cleanup and naming work can wait. No universal file/function
length thresholds gate the quality track; enforce actual project standards
when applicable.

For exploratory testing, establish the app adapter and service ownership. If
unavailable, record the coverage gap and its consequence for the release
checks; do not build an adapter outside the authorized scope. Never run two
app-driving tracks against conflicting service state.

For docs, distinguish factual drift from voice preferences. Correct text that
misstates the implemented guarantee; changing advertised support to conceal a
bug is a product choice. Voice proposals follow the authorization policy.
No track deploys or publishes text externally.

Unconfigured linter/dead-code probes are advisory. Only concrete defects or
project rules become findings; do not add configuration or churn style to
satisfy an unsolicited probe.

## Run one round

Label artifacts and outcomes `ROUND-<n>:code-review`, `:static`, `:exploratory`,
`:quality`, `:docs`, `:records`, `:plan`, `:fix`, and `:verify` as applicable.

### 1. Capture the candidate and coverage

Capture a fresh immutable candidate each round, the exact full range from the
resolved base, and the delta since the previous reviewed candidate. Never
reuse the initial head for a later review. Preserve dirty content in a snapshot
when needed. Do not mutate tracked files during review; if candidate content
changes, discard affected artifacts, record why, and review the new candidate.

ROUND-1 reviews the requested full scope. Later rounds focus on changed fixes,
shared boundaries, affected guarantees, and gaps, while retaining the full
candidate range as context. Broaden review when the changes warrant it. State
which scope was actually inspected; a focused pass is not a fresh full audit.

### 2. Review without mutating the candidate

Dispatch selected tracks with the release contract, exact candidate and ranges,
requested coverage, stable finding inventory, original repros for pending
closures, accepted maintenance constraints, artifact path, and worker budget.
Reviewers receive scope decisions and evidence, not a fixer's expected verdict.
Require explicit closure
assessments for handed pending findings under the shared contract.

Recheck latent hazards when the delta touches their guards or introduces a
relevant entry point. Promote only a demonstrated reachable failure, with
fresh impact/reach calibration. Several guarded paths alone do not establish
that a redesign is needed.

Reuse verification results when their code, tests, configuration, dependencies,
and relevant environment are unchanged. Run appropriate checks for changed
inputs and record the tested candidate. Never claim an unexecuted test passed.

### 3. Record evidence and triage through fix planning

After all review tracks stop, merge their artifacts into the run's CR/ET files.
Deduplicate, preserve stable IDs and earlier evidence, assign durable IDs to
new findings, and record exact coverage. Apply status changes only when their
shared-contract evidence is present; silence never closes an entry.

Invoke `infi-fix-planning` with `phase: plan` and:

- release guarantees, limitations, maintenance preferences, and authorization;
- candidate, input findings including provisional suggestions, and relevant
  history/dispositions from CR/ET;
- baseline results, exact verification plan, remaining round budget, worker
  capacity, and assigned `ROUND-<n>/plan.md` artifact.

The returned sheet clusters, diagnoses recurrence, compares maintenance costs,
and proposes fixes or dispositions. It must cover every input finding exactly
once. New suggestions enter triage; their discovery does not expand the release.
Use shared risk rankings to order discussion, with explicit gate reasons and
maintenance tradeoffs deciding action. Do not convert priority into an
automatic fix mandate or infer risk acceptance from silence.

Apply the existing authorization policy to the concrete sheet. Record chosen
alternatives, residual decisions, and any still-pending product questions.
Independent authorized plans may proceed without forcing unresolved choices.

### 4. Execute one authorized fix round

Invoke `infi-fix-planning` with `phase: execute`, the chosen plans verbatim,
original findings, candidate, authorization, baseline, verification plan,
worker budget, and `ROUND-<n>/fix.md` artifact. Confirm the candidate still
matches the planned input; changes affecting a plan require revalidation.

The fix skill owns fixer scheduling, production-path red proofs, integration,
maintenance reassessment, required gates, and fresh closure verifiers. It
returns tested snapshot, actual maintenance changes, gate results, explicit
closure verdicts, and unresolved issues. It edits only authorized implementation
files and never commits or changes durable records. You handle newly
uncovered scope choices; do not run a second implementation workflow alongside
it or repeat a gate that already passed on identical inputs.

### 5. Verify the handoff and record provenance

Check that the returned evidence covers each plan and any shared integration
boundary against the actual final product/test content. Apply the shared
closure states to CR/ET. A fresh closure verifier can establish closure within
this round; missing evidence leaves `fixed — pending verification` with the
specific gap. Later product changes invalidate affected evidence.

A failed required check blocks readiness. Attribute it against the baseline.
For a suspected unrelated flake, reproduce in isolation, then rerun the affected
suite once if isolation passes; an isolated pass never establishes suite green.
Record repeated failures as unresolved. Fix planning owns its bounded repair
pass; further failed attempts go to diagnosis, not an unbounded retry loop.

When commit authorization exists and verification succeeds:

1. Commit only the verified fixes/tests and current record updates, grouped
   by separable plan or integration batch under the project's commit policy.
2. Capture hashes and backfill them into CR/ET in a records-only provenance
   commit. Verify the product/test content matches the tested snapshot and the
   provenance commit contains no product or test code.

Without commit authorization, leave a reviewable diff and record the tested
snapshot. Inner skills never commit. If no fixes were needed, record the review
and its evidence without inventing a fixing hash. Preserve user/unrelated edits.

### 6. Evaluate the release guarantees

Evaluate the stopping rules against current evidence and authorized residuals.
Continue only for a concrete unresolved guarantee, required check, affected
interaction, or selected finishing track. Name what the next pass will establish.
A new whole-PR review is not required merely to change a status label.

## Schedule finishing work without postponing maintenance

- ROUND-1 runs `static` and `code-review`, plus selected exploratory coverage.
- Subsequent correctness rounds review fixes and interactions that changed,
  with required checks. Rerun exploratory coverage when its observed behavior
  changes; skip unchanged clean inputs with the reason recorded.
- Once correctness guarantees meet their bar, run selected `quality` and `docs`
  finishing tracks. Their optional two-round reserve covers proposals/fixes
  and independent verification. Do not discover new discretionary work on the
  last round and silently claim its implementation was reviewed.
- Send accepted refactors and documentation fixes through the same fix skill.
  Recheck the behavior and guarantees they affect. Rerun docs when a later fix
  changes described behavior. Optional proposals may remain follow-ups.
- Maintenance assessment of fixes happens in every round regardless of whether
  the optional quality track was selected.

## Diagnose repeated failures before escalating

Use the recurrence categories in the shared contract: incomplete correction,
later regression, changed guarantee, or structural inability to enforce it.
Two recurrences on one guarantee, or two consecutive fix-caused failure rounds,
trigger diagnosis before another patch. A finding count, file length, or several
latent hazards is a prompt to inspect, not proof of architectural failure.

When evidence shows an ownership/representation problem, or a necessary fix
exceeds settled product decisions, dispatch one read-only architect with the
causal history and release contract. Ask for credible options with maintenance
and product consequences, including completing the current design or accepting
a limitation when compatible with release requirements. Do not force a different
alternative just because the previous implementation was incomplete.

Present unresolved choices with concrete consequences. Record an authorized
contract amendment before dependent implementation. If the user defers a live
blocker, state the effect on release readiness. Keep prior fixes and evidence
attributable. The architect diagnoses and proposes; fix planning implements.

## Stop when the agreed guarantees are verified

Default release bars, adjusted by explicit user decisions:

- Required project gates and prescribed surface checks have passing evidence
  applicable to the final candidate. Coverage gaps affecting required guarantees
  remain blockers; advisory probes do not become requirements.
- Every required release guarantee has current affirmative evidence. Live
  blockers and conditional findings are corrected or have specifically
  authorized residual treatment compatible with the release decision.
- Implemented fixes have explicit closure evidence, including their maintenance
  tradeoffs and relevant interactions. New suggestions have dispositions or
  remain clearly optional follow-ups; discovery alone does not mandate a fix.
- Selected docs coverage accurately describes the final supported behavior.
  Optional quality/voice proposals are decided or left as follow-ups under the
  authorization policy. No generic size threshold must be satisfied.

Keep these bars stable across rounds. Do not automatically relax them to
"no P0/P1" after several attempts or label lower-priority defects accepted.

Default budget: at most five correctness rounds, then up to two finishing rounds
if those tracks were selected and correctness met its bar. Stop as soon as the
selected guarantees and checks are satisfied; unused rounds are not a reason
for more work. A cap, unavailable verification, or unresolved product decision
ends with the remaining work and its release consequence stated, not a claim
of convergence. Renewed work requires appropriate scope/authorization and budget.

## Report the outcome

Lead with what is ready and what remains unresolved. Include:

- Verdict: verified for the stated release guarantees, or incomplete with the
  specific cap, evidence gap, or unresolved decision and its merge consequence.
- Changes and dispositions, linked to stable findings and fixing commits or the
  tested uncommitted snapshot. Preserve S/F → P in finding records and handoffs.
- Maintenance costs added and removed, particularly any new caller obligations,
  ownership, states, protocols, or conversions accepted during the run.
- Actual checks, review coverage, and limits. Distinguish focused verification
  from full-scope review and proposed tests from executed ones.
- Residual consequences, authorization, revisit triggers, latent hazards, and
  optional/out-of-scope follow-ups. Deferred is not synonymous with safe.
- Links to CR/ET records and the run directory.

No pushes, PR comments, tickets, deployments, or other external writes are
implied by this workflow. Use existing authorization when those are separately
requested; otherwise finish with reviewable local work.
