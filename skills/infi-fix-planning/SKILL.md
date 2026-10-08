---
name: infi-fix-planning
description: Triage review findings and compare durable fixes by user impact, maintenance cost, and verification evidence. Supports plan-only requests and one authorized implementation-and-verification round, standalone or inside infi-review-loop. Use when asked to plan or fix review findings, apply a CR or ET report, or continue a fix round.
---

# Fix planning

Protect the agreed supported workflows while keeping future changes easy.
Turn findings into proportionate decisions, then implement and verify the
chosen corrections when authorized. A useful round may fix, reject, defer,
or accept findings; clearing every report is not the objective.

Read [the shared review contract](../infi-code-review/references/review-contract.md)
for evidence, risk, status ownership, dispositions, recurrence, and closure.
Review-time `Fix:` hints are inputs. Planners derive the solution from the
current code and the supported guarantee.

One invocation handles one bounded round: reconcile → cluster → plan → apply
existing authorization or obtain missing decisions → implement → verify →
record. This skill never launches another review round, pushes, opens PRs,
comments externally, or files tickets.

## Choose the requested mode

- **Plan-only:** a request to propose, compare, or plan fixes ends with the
  decision sheet. Planners read code, but do not edit product/test files or run
  the full verification suite just to estimate work. Record a standalone plan
  in the ledger unless the user requests discussion only.
- **Standalone fix:** a request to fix findings includes implementation within
  the user's stated scope and authorization. Use the standalone ledger and
  record procedure below. Ask only about unresolved decisions the existing
  authorization does not cover.
- **Loop mode:** `infi-review-loop` hands you `phase: plan` or `phase: execute`,
  a scope/release contract, exact candidate, stable findings and history,
  baseline results, verification commands, worker budget, and an assigned
  untracked artifact path. `plan` returns the decision sheet without source
  edits. `execute` receives the chosen plans and explicit authorization from
  the loop, then implements and verifies them. Return artifacts and outcomes;
  never allocate a FIXES ledger, modify CR/ET records, commit, independently
  change the scope, or ask the user to approve the same choices again.

Keep summaries, plans, verdicts, and evidence in the orchestrator's context;
use planners, fixers, and fresh verifiers for substantial code inspection.
Inspect a bounded source excerpt yourself when needed to judge a handoff.
Schedule workers within the actual capacity; overlapping fixes are sequential.

## Calibrate before planning

1. Resolve the review base: explicit user/workspace base, then the PR's actual
   base, then the repository default. Record exact base and candidate hashes,
   including a snapshot of uncommitted changes when present.
2. Read project instructions and discover its required checks. In standalone
   fix mode, run the appropriate gates before implementation as a baseline and
   after implementation. In plan-only mode, identify them without running the
   full suite. In loop mode, reuse the handed baseline and verification plan.
3. Resolve the input: an explicit report wins; otherwise use the newest report
   matching the branch/PR. If none matches, request the missing scope. If the
   recorded candidate differs, revalidate each finding against the current code.
4. Establish the supported workflows, release guarantees, known limitations,
   and maintenance preferences from the request and existing project evidence.
   State inferred assumptions. Surface unresolved product or trust decisions
   before selecting dependent solutions; do not invent commitments.
5. Outside loop mode, resolve the PR number and use `findings/FIXES-PR<id>.md`,
   or `findings/FIXES-<branch-slug>.md` without a PR. Preserve existing history;
   number new `ROUND-` sections after the highest existing number.
6. Record available worker capacity. Planners and verifiers get the same
   guarantee, scope, and evidence definitions as the orchestrator.

## Reconcile and cluster

Match findings by guarantee and sites, preserving the first ID and later
aliases. Classify them as new, known-open, standing disposition, or recurrence.
A standing decision is reconsidered only when material evidence, consequence,
reach, scope, or an agreed revisit trigger changes; a new numeric label alone
is not evidence. Diagnose recurrence using the shared contract before choosing
another approach. Missing an entry point can justify completing a sound design.

Close pending findings only from affirmative closure evidence for the current
candidate. A later report's silence never closes them. If all release
obligations are already verified and residuals authorized, update records and
stop without manufacturing another fix round.

Cluster symptoms of one broken guarantee into one plan. A test gap caused by
those symptoms becomes that plan's proof obligation. Do not merge unrelated
bugs merely because they share a module or abstract programming pattern.

Before alternatives, inspect the actual producers, consumers, entry points,
and relevant error paths of the guarantee. Record which were checked and any
coverage limits. Additional symptoms inside the agreed scope join the plan.
Unrelated or pre-existing defects are follow-ups. A minimal change to older
code may belong in the plan when necessary to restore the in-scope guarantee;
explain that dependency instead of silently expanding into a repository-wide
repair.

## Compare durable solutions

Choose the smallest durable correction that satisfies the supported guarantee.
Prefer designs that reduce caller obligations. A local guard is appropriate
when it belongs at the boundary and completely handles the demonstrated
failure. A structural change earns its cost when it resolves demonstrated
ownership or representation problems. Neither fewer lines nor a redesign is
inherently the better correction.

For each credible alternative, explain the maintenance change in a short
paragraph, proportional to the decision:

- **Enforcement:** who owns the rule, and whether that authority spans all
  relevant contexts, processes, or entry points. One file is not necessarily
  one writer or one trust boundary.
- **Caller obligations:** what callers must remember before and after: ordering,
  preconditions, flags, validation, conversions, or cross-module coordination.
- **Added and removed complexity:** states, representations, protocols,
  dependencies, fallbacks, and duplicated decisions. New machinery should
  replace obsolete machinery where feasible. A justified fix may still add code.
- **Proportionality:** why the benefit warrants the continuing maintenance cost,
  given the consequence, reach evidence, recovery, and accepted limitations.

For a rare recoverable failure requiring substantial machinery, explicitly
compare accepting or documenting the limitation. Do not propose acceptance
when it contradicts an agreed release requirement without identifying the
required product decision. Keep genuine defects' severity independent of cost.

## Write the decision sheet

Each plan `FP<n>` includes:

- **Covers:** finding IDs and their S/F → P triples. Every input finding belongs
  to exactly one plan or disposition; never silently drop an inconvenient one.
- **Problem:** an effect-first headline and one or two sentences stating the
  supported workflow, trigger, consequence, recovery, and relevant reach limits.
- **Default solution:** plain words immediately after the problem, explaining
  what changes and why it restores the guarantee. Name any supported behavior
  removed or restricted; distinguish temporary containment from a durable fix.
- **Planning detail:** the guarantee and its basis, authoritative owner, sibling
  paths inspected, and recurrence diagnosis when applicable.
- **Alternatives:** one credible option is enough. Each gives the maintenance
  assessment above, regression surface, residual risk, and verification cost.
  Include rough added/removed and touched LOC ranges, separating production
  code from tests/generated output. Size supports the comparison; it does not
  determine the preferred option or imply a complete design.
- **Proof:** the reproduction or test, mapped to the real product call path and
  the guarantee it verifies, plus relevant neighboring behavior. P0/P1 require
  red-then-green evidence; if an automated test is infeasible, give the exact
  repeatable repro and verification limits. Proposed checks are not run results.
- **Avoid:** a concrete tempting partial fix or disproportionate expansion,
  when one is relevant; do not invent a warning to fill a template.
- **Decision and dependencies:** recommendation, `mechanical` or `judgment`,
  plan ordering, overlapping files, and shared contracts needing integration.

Ordinary alternatives cover the same findings. A structural option regrouping
several plans is a separate `PO<n>` portfolio option: name the replaced plans,
union of findings, maintenance tradeoff, combined cost, and proof. Validate
that every selectable portfolio still covers each finding exactly once.
Account for shared test infrastructure without double-counting it.

Dispositions use the shared contract and explain why a fix is not selected.
`Mechanical` means established intended behavior, bounded existing ownership,
and no unresolved product, support, or architectural choice. There is no LOC
threshold. Everything requiring a tradeoff is `judgment` (legacy `taste`).
Neither label overrides the authorization already given by the user.

Render the summary above the detailed plans, understandable without opening
source:

| Plan | Problem → default solution | Maintenance change | Decision | Size context |
| ---- | -------------------------- | ------------------ | -------- | ------------ |
| FP1 | **Reset can lose a later save.** Queue reset with existing writes so their local order is preserved. | Reuses one queue; no new state. Cross-context ordering remains outside this guarantee. | Mechanical; covers CR12-1 (S1/F2 → P1) | Production +5…+10 / −0; tests +15…+25 / −0 |

Use the existing effect-first detailed labels where helpful: `🚨 Problem`,
`✅ Default`, `🔀 Alternative`, `🔎 Planning detail`, `📏 Size`, `🧪 Proof`,
`⚠️ Trade-offs`, `🚫 Avoid`, and `🔗 Dependencies`. Put the maintenance
assessment under Trade-offs. Omit empty labels. Recompute displayed totals
from the options actually selected; an estimated small diff is not a reason
for a default that removes the product's core behavior.

## Apply authorization once

Plan-only always ends at the sheet. For implementation, first check the user's
request and prior decisions. Proceed with choices already authorized; do not
request confirmation again because the plan is classified as judgment.

For unresolved tradeoffs, present concrete alternatives and their maintenance
and product consequences. Ask only for the missing decision. Independent
already-authorized work may continue if it does not constrain that decision.
In loop mode, return unresolved choices to the loop orchestrator; it alone
applies the autonomy policy and talks to the user.

When offering a reply such as `FP1-A, FP3-B, accept CR12-9`, state what a bare
"go" or omitted choice would adopt. Read a partial answer in context; an
objection is not approval of its dependent work. Record the decision or the
specific earlier authorization, never infer approval from elapsed time.

## Implement the chosen plans

One fixer owns each guarantee cluster. Serialize overlapping files. Disjoint
files may still share a lifecycle: merge such assignments or name an integration
owner and a cross-boundary test before dispatch. No fixer also verifies its own
closure.

Give fixers the chosen plan, original evidence, supported guarantee, maintenance
assessment, scope, and exact checks. Require:

- Red proof first for P0/P1, using the real lifecycle and authoritative public
  interface where applicable. A bundler test does not prove installed native
  package imports; an isolated queue test does not prove cross-context order.
- Stay within the plan's surface. Report newly discovered contract questions,
  neighboring defects, or required structural work before dependent edits.
- Reassess if implementation introduces an unplanned state, protocol, owner,
  compatibility path, or broader caller obligation, even below the LOC estimate.
  A material size overrun calls for inspection and revised estimates; stop only
  when it exposes a scope or tradeoff change outside existing authorization.
- No test weakening, speculative fallbacks, or unrelated cleanup.

Return the actual diffstat split by production/tests, red/green evidence,
commands run, deviations, and actual maintenance changes.

## Verify the complete correction

Run the required gates and relevant surface checks, attributing failures
against the baseline. In loop mode, execute the handed verification plan once
for the integrated fixes and return exact results; the outer loop reuses them
when the tested content is unchanged.

Dispatch a fresh read-only closure verifier for each plan or related integration
batch, outside the fixer threads. Supply original findings and repros, scope,
chosen guarantee, accepted maintenance constraints, and candidate, without
prescribing a conclusion. Require the shared closure contract: explicit actual
proof, examined sibling entry points,
neighboring behavior, and whether the implemented maintenance cost matches the
accepted tradeoff. Distinguish a correct necessary guard from a new fallback
that preserves ambiguous ownership. Record unverified surfaces as gaps.

A failed verdict gets one bounded repair pass and renewed verification. If it
fails again, stop that plan, diagnose the cause, and report unresolved work.
Revert only this round's isolated edits when safe and appropriate; preserve
user edits and dependent work. Never mark an unproved correction closed to
satisfy a round limit. Other independently verified plans retain their results.

## Record and finish

**Loop mode:** write the chosen plans, dispositions and their authorization,
actual changes, tested candidate snapshot, gate results, closure verdicts,
recurrence diagnoses, and unresolved decisions to the assigned artifact. Return
it to the loop. No commits or durable-record edits; the loop owns those.

**Standalone:** the FIXES ledger is the sole current status owner. Preserve the
review snapshots and append one pointer to the ledger if absent. Record:

- Scope/base/candidate, supported release guarantees and limitations.
- Findings with stable IDs/aliases, S/F → P, status, plan, and fixing commit.
- Each `ROUND-<n>`: decision sheet, authorization, actual maintenance changes,
  production/test size context, exact gate results, and closure evidence.
- Residuals with reasons, authorization, and revisit triggers.

Commit only when the user's request, project workflow, or existing session
policy authorizes commits. Use one verified commit per separable plan or
integration batch, followed by a records-only commit to backfill hashes if
needed. With no commit authorization, leave changes reviewable and record the
tested snapshot. Never commit a failure introduced by the round. A baseline
failure remains disclosed and may still prevent release readiness.

Mark `verified-closed` only when the shared evidence requirements are met.
Otherwise use `fixed — pending verification` and name the missing evidence.
Do not require a fresh whole-PR review just to change that label.

Report the outcome, implemented and dispositioned findings, maintenance costs
added/removed, actual verification and limits, links to records, and only the
next review work justified by changed or unexamined surfaces. Plan-only reports
the decision sheet and makes clear implementation has not run.

## Stop on evidence, scope, or the round budget

A standalone round ends after its requested phase. Across rounds, convergence
means verified release guarantees and authorized residuals under the shared
contract. New suggestions return to triage instead of expanding the release.

Two recurrences on one guarantee, or two consecutive rounds with fix-caused
failures, require diagnosis before another patch. Distinguish incomplete work,
later regression, changed contract, and structural inability. If evidence
points to a structural problem, use a read-only architect to compare credible
options, including completing the current design or accepting a limitation.
Do not force a new architecture because a counter increased.

Default standalone budget: four fix rounds per PR unless the user sets another
limit. The loop's handed budget overrides this in loop mode. A cap ends with
unresolved work and verification limits reported; it never accepts risks or
claims the release is ready on the user's behalf.
