---
name: infi-review-loop
description: Iteratively polish a scope-settled feature branch or PR until it converges — alternating rounds of capacity-scheduled review tracks (code-review subagents, exploratory testing, static analysis, soft code-quality/architecture review, docs/marketing-copy drift) with fix rounds in between, repeating until reviews come back clean or hit agreed stopping bars. Use whenever asked to "run the review loop", "polish this PR until clean", "review and fix until done", "iterate on this feature until it converges", "harden this branch", or to take a finished-scope feature through repeated review-fix cycles.
---

# Review loop

You are the **loop orchestrator**. The input is a feature whose scope is
settled (a PR or branch); the output is the same feature, unchanged in scope,
improved in everything else — correctness, robustness, UX, static cleanliness,
and code quality. You get there by looping: run review tracks, fix what they
find, run them again, until the bars are met.

Three levels of agents: **you** (plan rounds, hold the scope contract, judge
convergence, talk to the user) → **track and fixer subagents** (one per review
track or fix batch per round) → **workers** the track subagents spawn
themselves (focus reviewers, walkers, reviewer panels). You never review or
fix inline — context is your scarcest resource and the loop needs all of it.

The skill is project-agnostic: every command, path, and convention it needs is
discovered in Phase 0 and written into the contract, not hardcoded here.

## Context budget

The loop dies when any level fills its context with another level's work, so
each level holds only what its decisions need:

- **You (level 1)** hold the contract, the ledger, findings *summaries*,
  verify verdicts, and command output. Never file contents or full diffs —
  when you need a fact about the code (line counts, trigger checks, "is this
  export referenced?"), get it from `git diff --stat`, `wc -l`, grep counts,
  or a throwaway read-only exploration subagent, not by reading the file. If
  you catch yourself reading source to "double-check" a finding, you are doing
  level-2 work and paying for it with round-planning capacity.
- **Track and fixer subagents (level 2)** hold one track or one fix batch:
  the contract, their slice of the diff, and the findings assigned to them.
  Never the whole run — a fixer does not need other tracks' reports.
- **Workers (level 3)** hold one focus, one scenario, or one file cluster.
  The track subagent that spawned them owns the merge.

Summaries flow up, never raw material: subagents write full detail to their
`<run-dir>` files and return only counts, verdicts, and finding titles. If you
need more than a returned summary, read the round file — it is written to be
skimmed — not the sources behind it.

## Capacity and worker discipline

The fan-out design assumes slots exist. When it does not check, the classic
failure is this: "parallel" tracks serialize behind idle track orchestrators
that consume the budget while doing no work, one runaway reviewer blocks every
walker, and a finished worker thread gets reused for a supposedly blind lens.
Plan for the capacity you have, not the one the skill imagines:

- **Probe first.** Establish the real concurrent-subagent budget in Phase 0
  and record it in the contract; it is as binding as the scope.
- **Parallel-track mode.** Use it only when the confirmed capacity can hold
  every selected track orchestrator plus the workers in each track's handed
  plan at the same time. Run those tracks in parallel.
- **Constrained mode.** When slots cannot hold the track orchestrators *plus*
  their planned workers, run the tracks sequentially and give the active track
  the full worker budget available beneath its orchestrator. Parallelism is a
  means; starving every track's workers to keep two coordinators alive inverts
  the point.
- **Independence beats concurrency.** Merge review lenses into fewer *fresh*
  reviewers before ever reusing a finished thread — a reviewer resumed on a
  used context is not blind. Reviewers are never spawned as children of fixer
  threads.
- **Milestones, not pleading.** Every worker prompt carries a milestone
  contract: artifact skeleton first, first product action or finding by a
  named checkpoint, partial artifact updated as it goes. A worker that misses
  a milestone gets one reminder, then is interrupted. An interrupted worker
  with a valid partial artifact is a *result* — a documented coverage gap;
  three finalization requests to the same worker is the process failure.
  Never let one overrunning worker block the round.
- **Degrade around stale slots.** After interrupting a worker, probe capacity
  again. If the platform still counts that context as active, treat the slot as
  unavailable: shrink the handed budget, continue sequentially where the
  remaining independence contract is executable, or record a setup coverage
  gap and stop that track. Never reuse the stale context as a fresh reviewer or
  wait indefinitely for repository code to reap a platform-owned thread; record
  the event in `META` for later troubleshooting.

## What a run produces

- `<run-root>/review-loop/<date>-<slug>/loop.md` — the scope contract, the round
  ledger, and per-round outcomes. The single source of truth for the run.
  `<run-root>` is the project's gitignored scratch directory (`.context/` if the
  project uses one, otherwise `.review-loop/`, added to `.gitignore`).
- Durable tracked findings: the loop orchestrator owns one `findings/CR<N>.md`
  and, when exploratory testing is selected, one `findings/ET<N>.md` for the
  whole run. Review tracks write only their disjoint untracked ROUND artifacts;
  after all selected review tracks finish, the loop orchestrator updates the same
  durable files in a separate records step. Never one file per round.
- Each successful fix step has a verified fix commit, followed by a
  records-only provenance commit that backfills that fix commit's hash into
  the CR/ET records. This avoids a commit needing to contain its own hash while
  keeping every round diffable and attributable.
- A final summary for the requester in product terms.

## Phase 0 — Scope contract (always stops for confirmation)

Never start reviewing before the user confirms the contract. The whole loop is
only safe to run autonomously because the contract fences it in; an unconfirmed
contract means autonomous scope drift.

1. **Calibrate the project.** Establish and record:
   - the default branch (`git symbolic-ref refs/remotes/origin/HEAD`, else `main`);
   - the project instruction files (`CLAUDE.md`, `AGENTS.md`, `CONTRIBUTING.md`,
     package-level guides) and any communication-style rules they impose on the
     final report;
   - the **static gates** — the project's own typecheck/lint/test/format
     commands, read from `package.json` scripts, `Makefile`, `justfile`,
     `pyproject.toml`, `Cargo.toml`, `go.mod`, or the CI workflow. Prefer the
     exact commands CI runs; if CI is the only source of truth, name the
     workflow file;
   - the **non-static test tiers** — integration, end-to-end, visual, packaged,
     or manual suites, and the rule for when each is required (usually stated in
     the project's testing guide);
   - the findings directory (default `findings/`) and the run root.
2. Identify the diff (branch vs the default branch unless told otherwise) and
   read the PR body, plan docs, and recent commits.
3. Write the contract into `loop.md` and present it in the project's preferred
   communication style — defaulting to decision-first: the question, labelled
   options with their impact, a recommendation, then next steps.
   - **Scope** — what the feature is, in product terms; the boundary fixes may
     not cross (no new features, no behavior outside the diff's intent).
   - **Fixed decisions** — design/UX choices and architectural aspects that are
     settled and must not be relitigated by any reviewer or fixer.
   - **Cleanup** — whether ROUND-0 cleanup will run, and which files trigger it
     (see below).
   - **Tracks** — which review tracks this run uses and why (see table).
   - **Capacity** — the probed concurrent-subagent budget and the resulting
     scheduling mode (parallel tracks vs constrained sequential mode). Record
     each selected track's planned worker allocation so the mode is auditable.
   - **Autonomy** — proposed level (below), user picks.
   - **Stopping bars and round budget** — the defaults below, including the
     five-round correctness budget plus the two-round Stage-B finishing
     reserve; the user may tighten or loosen them.
   - **Verification plan** — the full static suite plus every non-static test
     tier prescribed by the changed surfaces' project guides. Name the exact
     commands discovered in step 1, and the rule that decides when each
     non-static tier is required.
   - **Commit policy** — a verified fix commit plus its records-only provenance
     commit for each successful fix round; confirm.
4. Get explicit confirmation — of the whole contract, not a slice of it.
   Present every section as a labelled decision with a stated default, and
   say plainly that a reply confirms the defaults it does not override. Never
   fold stopping bars, the verification plan, or commit policy into prose the
   user can miss: a terse "A1, B1" reply must not be read as agreement to
   sections that were never presented.
5. **Allocate the run's durable records once, immediately after confirmation.**
   Scan the findings directory for `CR*.md` and allocate one greater than the
   highest CR suffix; do the same independently for `ET*.md` when the exploratory
   track is selected. Create each allocated path with the date, exact
   scope/base/head when known, and a `Pending ROUND-1` status, then record the
   paths in `loop.md`. Review tracks receive their untracked ROUND artifact paths
   and the existing durable finding inventory needed to recognize follow-ups;
   they never allocate or edit CR/ET files. The loop orchestrator updates the
   allocated records after the review step.
6. Run the confirmed verification plan once as the pre-review baseline and
   record each command and result in `loop.md`, then start ROUND-0 when
   triggered or ROUND-1 otherwise. A red baseline is review evidence, not
   permission to narrow the confirmed plan.

Autonomy levels (propose `checkpoint` unless asked otherwise):

- **checkpoint** — stop after every round's reviews; user approves the fix
  plan before anything is changed.
- **guided** — fix P0–P2 mechanical findings autonomously; stop only for
  taste/judgement calls (quality-track proposals, ambiguous product behavior).
- **autonomous** — run to convergence or the applicable stage/total cap without
  stopping; taste proposals are logged as follow-ups, never auto-applied.

## ROUND-0 — Cleanup (conditional, before any review)

Reviewers and fixers degrade sharply on oversized, cluttered code: a focus
reviewer cannot hold a 1000-line function precisely, and dead code produces
false findings that waste a fix round. So when the diff is messy, clean it
*before* the first review — every later round gets cheaper and sharper.

**Trigger** — run ROUND-0 only if the diff contains at least one of: a changed
function > ~150 lines, a changed file > ~500 lines, or obviously dead code
(unused exports, unreachable branches, commented-out blocks, leftover debug
scaffolding). Detect triggers cheaply — `git diff --stat`, `wc -l`, a grep for
commented-out blocks — without reading file contents into your own context.
Otherwise skip ROUND-0 and note the skip in the ledger.

**Who runs it** — subagents, like every other mutation in the loop. Spawn one
cleanup fixer per oversized file (or per small cluster of entangled files);
fixers over disjoint files run in parallel. Each fixer's context is only the
scope contract, its target file(s), and the mechanical rules below — that
narrowness is the point: a fixer holding one 900-line file splits it well, a
fixer holding the whole diff splits it sloppily. You only dispatch, verify,
and commit.

**Strictly mechanical, behavior-preserving moves only:**

- Split oversized functions into named steps; split oversized files along
  existing seams. Pure extraction — no signature redesign, no new
  abstractions, no renames beyond naming the extracted pieces.
- Delete provably dead code (verify with a search for references, not a
  guess); anything only *probably* dead is a finding for later rounds.
- Nothing that changes behavior, public APIs, or persisted data. Judgement
  refactors (re-abstracting, coupling changes, renames of existing things)
  belong to the stage-B `quality` track, not here.

Success is measured on the **largest remaining review unit across every file
the cleanup touched**, not on the named file: relocating an oversized
implementation intact behind a thin entry file is a rename, not a split — a
façade passes verification and then gets thrown away at review. Put this
acceptance rule in the fixer prompt so façades are never built at all. And "no
legal move" is itself a legal outcome: when no behavior-preserving split can
meet the bar, record *trigger fired, no safe mechanical move* in the ledger and
route the file to the quality track or architect step instead of forcing it.

**Safety** — cleanup happens before any correctness baseline exists, so it
must be provably inert: run `ROUND-0:verify` (full static suite) and commit
separately as `review-loop ROUND-0: cleanup`. If the code being split has thin
test coverage, extract more conservatively — smaller steps, one file per fixer
commit-checkpoint. Attribute any red verify against the Phase-0 baseline
before acting on it: a failure that already reproduces at the baseline is
pre-existing — file it as a finding and keep the cleanup, rather than throwing
away a good extraction over a pre-existing gate failure. A red the cleanup
*introduced* is reverted, not repaired: cleanup is optional by definition, and
debugging it burns the round budget the loop exists to protect.

The separate commit keeps the story honest: reviewers still review the full
branch diff, but any bug introduced here is attributable to ROUND-0 by diff,
not smeared into the feature.

## Review tracks

| Track | What it is | Cost | How to run |
| --- | --- | --- | --- |
| `static` | The project's own gates from Phase 0 (typecheck, lint, unit tests, format, project-specific checks) plus advisory zero-config dead-code/lint probes | cheap | inline or one subagent |
| `code-review` | Multi-reviewer defect hunt | medium | subagent follows the `infi-code-review` skill in loop mode |
| `exploratory` | Live-app walkers + reviewer panel driving the real app | heavy | subagent follows the `infi-exploratory-testing` skill |
| `quality` | Soft code-quality: oversized functions/files, naming, abstraction level, coupling, architecture within the feature | medium | a code-simplification skill if the project has one, else one reviewer subagent with the bars below |
| `docs` | Text-vs-code drift: do docs, READMEs, marketing copy, and in-app text still tell the truth about the changed behavior? | cheap | one read-only reviewer subagent |

Track notes:

- **static**: run exactly the commands in the confirmed verification plan.
  Zero-config probes the project has not adopted (a dead-export finder, an
  unconfigured linter) are *advisory* — fix only clear wins (dead exports, real
  bugs), never churn style, and never add linter configuration unless the
  contract includes it.
- **code-review**: pass the scope contract verbatim, immutable round scope,
  existing CR finding inventory, and assigned untracked artifact path. The CR
  number is context for stable follow-ups, not permission to edit the record.
  The inventory includes recorded latent hazards: every pass re-checks them
  against the round's delta — a new caller or entry point that bypasses a
  hazard's guard converts it to a live finding at its `S-if-unguarded`. That
  re-check is the early warning that catches a new entry point turning a
  guarded assumption into a reopened P0.
- **exploratory**: only when the diff touches a user-facing surface the project's
  exploratory adapter can drive. The track subagent owns the app server for its
  pass; never run two app-driving tracks at once, and scope its scenarios to the
  feature. If the project has no adapter yet, either budget a round for writing
  one or record the track as unavailable in the contract.
- **quality**: hard bars are objective (changed file > 500 lines, new function
  > 80 lines, obvious dead code) — normally already handled by ROUND-0, so
  here they catch what slipped through or regressed. The track's real job is
  judgement: renames, abstracting or de-abstracting, coupling changes. Those
  are **taste**: always presented as proposals with trade-offs for the user to
  accept, in every autonomy mode.
- **docs**: the reviewer starts from the *behavior the diff changed* and hunts
  every text surface that describes it: `docs/`, package and app READMEs and
  guides (testing, release, contributing), the marketing or landing site if the
  repo contains one, in-app copy and translation catalogs (a string changed in
  one locale is drift in the others), code comments, and skill or prompt files
  that state the old behavior. Two finding classes: **factual drift** (text says
  X, code now does Y) is mechanical → fix it; **voice** (tone, positioning,
  marketing wording) is taste → proposal only. Repo edits only — never deploy
  any surface; releases have their own procedures.

## Round anatomy

Label everything: the round is `ROUND-<N>`, its substeps
`ROUND-<N>:code-review`, `ROUND-<N>:exploratory`, `ROUND-<N>:static`,
`ROUND-<N>:quality`, `ROUND-<N>:records`, then `ROUND-<N>:fix` and
`ROUND-<N>:verify`, plus `ROUND-<N>:architect` when escalation triggers. Use
these labels in `loop.md`, in subagent prompts, in commit messages, and in every
user-facing update, so a human can replay the run from the ledger.

**1. Plan** — pick this round's tracks (policy below), record them in the
ledger with a one-line reason each. Then refresh the review candidate: capture
`git rev-parse HEAD` as this round's immutable `round input head`, derive the
exact full candidate range from the confirmed base to that hash, and record
both in `loop.md`. From ROUND-2 onward also record the previous round input
head and pass `<previous-round-head>..<round-input-head>` as the focused delta
that contains the intervening fix and provenance commits. The product scope
contract remains fixed, but its Phase-0 head is never reused as a later round's
candidate. Do not mutate tracked files between this capture and completion of
the review step. If HEAD changes anyway, discard those review artifacts, retain
the superseded scope identifier in the ledger, and start a new review attempt
with a newly captured immutable hash.

**2. Review** — dispatch the selected track subagents according to the
confirmed Phase-0 scheduling mode. In **parallel-track mode**, spawn all
selected tracks in parallel only because capacity can hold their orchestrators
plus every worker allocation in their handed plans. In **constrained mode**,
run tracks sequentially and hand the active track the full worker budget
available beneath its orchestrator; stop it before starting the next track.
Under either mode tracks are repository-read-only: no source, test,
configuration, or tracked findings edits. Each track may write only its
assigned disjoint artifact under `<run-dir>/ROUND-<N>/`. Every prompt includes
the scope contract verbatim, round label, immutable round input head, exact
full candidate range, the previous-round focused delta when one exists, any
existing stable finding inventory relevant to the track, its artifact path,
and its handed worker capacity.

**3. Records (`ROUND-<N>:records`)** — only after every selected review track
has stopped, read the untracked ROUND artifacts and update the run's
preallocated CR/ET files. The loop orchestrator alone performs this tracked
mutation: merge new evidence, preserve stable IDs and earlier round history,
append newly accepted findings after the record's highest suffix, and record
the exact immutable round scope. Track-local candidate IDs are not durable
until this step maps them into the CR/ET record. This records step is separate
from review and completes before triage or any fixer starts.

**4. Triage** — merge findings across tracks, then **cluster by root cause**:
findings violating the same invariant are one cluster, whichever track or
round surfaced them (the code-review track names each finding's `invariant` —
use it as the clustering key, and cluster exploratory/static findings the same
way). Split the result into: *fix now* (in scope, meets the round's bar),
*taste proposals* (quality judgement calls), *latent hazards* (real in
isolation, unreachable behind a remote guard — recorded with their
`S-if-unguarded` and guard location, never counted toward bars; their cheap
local enforcement — a fail-fast assertion or guard-pinning test — may ride
along with a fix batch when trivially in scope, otherwise it joins the
follow-ups), *out of scope* (violates the contract — goes to the follow-ups
ledger, never fixed silently). Order *fix now* by computed priority (the
`infi-code-review` severity × frequency matrix); tie-break within a priority by
severity, then frequency. Every finding keeps its full `S<n>/F<n> → P<n>` triple
through triage, fixer prompts, records, and reports — the triple is the
information, the P alone is only the ranking. At `checkpoint`, stop here and
present the fix plan with clusters shown as single units.

**5. Fix (`ROUND-<N>:fix`)** — spawn fixer subagents for the *fix now* list.
Fixers get the scope contract verbatim, the specific findings (file:line, why,
suggested fix, invariant, and the full `S/F → P` triple), and these rules: stay
inside the contract; for P0/P1 write the red failing test first, then make it
green; run the tests you touched. Batch related findings per fixer; serialize
fixers that touch the same files.

Root-cause discipline for fixers:

- **A cluster is one assignment.** Never split symptoms of the same invariant
  across parallel fixers — the classic failure is two fixers each patching
  their side of a shared persistence boundary, both passing locally, and the
  guarantee between them staying broken.
- **Fix the cause, then sweep.** State the invariant being restored, fix it at
  the point that makes every symptom impossible, then sweep the remaining
  paths that touch the same invariant (composed/manual variants of the fixed
  path, error branches, other callers) for unlisted symptoms.
- **Report, don't expand.** If restoring the invariant properly needs more
  than the assigned findings — a structural change, another subsystem, a
  contract question — stop and report that back instead of patching symptoms
  to get green. A symptom patch that leaves the invariant broken is the loop's
  most expensive failure mode: it costs this round *and* a later round's
  "closure invalidated" discovery.

Parallel-batch discipline:

- **Declare shared contracts before dispatch.** Write down what the batches
  share: who owns each lifecycle transition, what "persisted" means, which
  side acknowledges what. A shared contract either merges the batches into
  one, or names an integration owner who lands *after* them with a test that
  crosses the boundary. A fixer that discovers mid-fix it changed a
  cross-package contract reports it immediately so the integration step gets
  scheduled — otherwise you are inventing an unplanned integration batch late,
  because three "non-overlapping" batches turned out to share one lifecycle.
- **Red tests must model production.** A P0/P1 red test reproduces the
  production lifecycle — the same sequence and timing the real caller
  performs — not a convenient approximation. A test that manufactures a state
  production never reaches proves nothing; a fix can stay green for a full
  round while the bug survives, because the test held a resource longer than
  production ever does. The testing reviewer checks fix tests against
  production call paths for exactly this.

**6. Verify and record (`ROUND-<N>:verify`)** — run the full static suite plus
every command in the confirmed verification plan whose test files or observed
behavior changed since its last green run. Any user-facing fix re-runs its
prescribed surface tier, per the rule recorded in the contract. Red → the fix
round failed; do not commit broken state, spawn a repair fixer, and re-verify.

Flake protocol — for a failing test that neither this round's diff nor its
tests touched: reproduce it in isolation first. If the isolated run passes,
rerun the affected suite once; a second full-suite failure blocks regardless
of isolated passes. Either way, record the test in the ledger's
flake-candidate list so the next occurrence is a pattern, not a fresh
investigation. An isolated pass alone never establishes green, and
pre-existing vs introduced is decided against the Phase-0 baseline.

When verification is green, use this sequence so provenance is possible:

1. In the CR/ET records, mark fixed findings `fixed — pending re-review
   (ROUND-<N>:fix, commit pending)` and update the ledger.
2. Commit the fixes, tests, and current record updates as
   `review-loop ROUND-<N>: <summary>`; capture the resulting hash.
3. Replace each `commit pending` marker with that exact hash. Commit only the
   tracked CR/ET provenance changes as
   `review-loop ROUND-<N>: record evidence`. (`loop.md` remains the gitignored
   run ledger.) Confirm the provenance commit contains no product or test code.

If a round converges without a fix step, commit changed CR/ET review evidence
once as `review-loop ROUND-<N>: record clean review`; there is no fixing hash
to backfill.

A green suite does not close a finding — marking something "resolved" right
after a fix invites false confidence. Findings move through explicit states in
the CR/ET records: `open` → `fixed — pending re-review` (fix committed,
provenance recorded) → `verified closed` (a later review round covered its paths
and found no new counterexample against its invariant) → or `closure
invalidated` (a new counterexample on the same invariant — which is also an
architect-escalation trigger). Convergence counts only `verified closed`; the
final review round that meets every bar is what verifies the last batch.

**7. Converge or continue** — evaluate stopping rules; either start
ROUND-<N+1> or write the final report.

## Track selection policy

Correctness first, beauty second: refactoring code that still has P0/P1 bugs
wastes both rounds, so quality waits until the defect hunt has converged.

- **ROUND-0**: cleanup, only when triggered (see above).
- **ROUND-1**: `static` + `code-review`, plus `exploratory` if the feature is
  user-facing and an adapter can drive it.
- If a fix round itself leaves a file or function over the cleanup bars,
  prepend a mechanical cleanup step (same rules as ROUND-0) to the next round
  before its reviews.
- **ROUND-2+ (stage A)**: `static` every round; re-run `code-review` while it
  still finds fixable issues; re-run `exploratory` only if the previous fix
  round changed user-facing behavior.
- **Stage B** (first round after code-review meets its bar): add `quality`
  and `docs`. Entering Stage B activates its reserved two-round finishing
  budget even when Stage A used all five correctness rounds; never spend the
  last permissible round discovering Stage-B work with no review capacity
  left to verify its fixes. Both tracks deliberately run late — docs checked
  against round-1 behavior go stale the moment a fix round changes that
  behavior, so check text once the behavior has stopped moving. Apply accepted
  refactors and doc fixes, then run one more `static` + focused `code-review`
  pass over the refactor diff — refactors are where "fixed" features quietly
  break.
- Re-run `docs` only if a later fix round changed user-visible behavior
  again.
- Skip any track whose previous pass was clean and whose inputs haven't
  changed since; note the skip in the ledger.

## Architect escalation (`ROUND-<N>:architect`)

Some findings are not bugs to patch but symptoms of a structure that cannot
hold its own invariants. Fix rounds cannot converge on those — each round
patches the newest counterexample and the next review finds another. The
architect step exists to stop that treadmill by changing altitude instead of
iterating.

**Triggers** — run it when any of these fire:

- **Closure invalidated**: a cause-level fix for a cluster is followed by a
  new counterexample against the *same invariant* in a later review round.
- **Oscillation guard** fires (see stopping rules).
- **Concentration**: three or more distinct findings across rounds land in
  the same subsystem or on the same boundary between two components. Latent
  hazards count toward this — several hazards hanging off one invariant mean
  no single component can enforce it, which is a structural fact even while
  nothing is technically broken.
- **Deferred by cleanup or a fixer** as "requires architecture work".

**What it does:**

1. Spawn one architect subagent — read-only, high effort — with the full
   finding inventory (CR/ET records, follow-ups ledger), the scope contract,
   and the trigger. Its job is diagnosis at the design level: name the
   structural property that keeps producing findings (a boundary with unclear
   ownership, an invariant no single component can enforce, state split
   across layers that must agree), then produce two or three structural
   options with trade-offs — including the honest option of staying with
   targeted patches — written in product and engineering terms.
2. **Brainstorm with the user — in every autonomy mode.** This is the one
   step besides Phase 0 that always talks to the user, because structural
   options usually touch the contract's fixed decisions and always trade
   scope against robustness. Run it as a real multi-step discussion: the
   question, the options with product impact, a recommendation; then iterate
   on the user's pushback rather than forcing a one-shot choice. The user may
   also defer the whole matter — that converts the cluster into an accepted
   residual with its risk stated.
3. **Record the outcome as a contract amendment** in `loop.md`: the chosen
   direction, what it un-fixes or re-opens, and the new bar for the affected
   cluster. The next round's fix step implements the decided direction; the
   architect never edits code.

The architect is an escalation, not a track: it runs between rounds, at most
once per trigger, and only when triggered — a loop that architect-reviews
every round is a design committee, not a review loop.

## Stopping rules

Defaults — confirm or adjust in Phase 0:

- **verification**: zero errors from every static gate and every applicable
  non-static command in the confirmed verification plan. A command may be
  skipped in an intermediate round only when neither its test files nor
  observed behavior changed since its last green run; all commands must be
  green together at convergence. Advisory linter output never blocks.
- **code-review**: rounds 1–2 aim for zero `blocks`/`conditional` findings of
  any severity. From round 3 on, the bar relaxes to **no P0/P1** — chasing
  every P2/P3 forever is how loops oscillate instead of converging. Remaining
  P2/P3 go to the final report as accepted residuals.
- **exploratory**: no new P0/P1 findings within the feature's scope.
- **quality**: hard bars met; taste proposals resolved by user decision (or
  logged as follow-ups in `autonomous` mode).
- **docs**: zero factual drift between the changed behavior and any text
  surface; voice proposals resolved like quality taste items.
- **Stage-A cap:** five review rounds for correctness. If code review has not
  met its bar by the end of the fifth Stage-A round, stop and report before
  Stage B; quality refactoring cannot safely rescue unconverged correctness.
- **Stage-B reserve:** once Stage A meets its bar, allow up to two additional
  rounds for the first `quality` + `docs` pass, its fixes, and one independent
  focused re-review. The total run is therefore capped at seven rounds, but a
  run that enters Stage B earlier receives only those two finishing rounds; it
  does not bank unused Stage-A rounds.
- Hitting either stage cap is a stop-and-report, not a failure to hide.
- **Oscillation guard**: if the same finding (same invariant) reappears after
  being fixed twice, or two rounds in a row fix things a previous round
  introduced, the loop is churning and more rounds will not help — escalate
  through the architect step, which puts the structural question to the user
  instead of spending another round on symptoms.

The loop **ends the moment every selected track's bar is met** in the same
round. Convergence, an applicable stage cap, and the oscillation guard are the
only three exits; never trail off mid-round without reporting.

## Final report

Update `loop.md` with the closing ledger, then report to the requester in the
project's preferred style, leading with the outcome in product terms:

- Verdict: converged / capped / escalated, and what that means for merging.
- What improved, round by round — counts per track, in one short table.
- Accepted residuals (the P2/P3s deliberately left) as full `S/F → P`
  triples, and why they're safe. A residual at `F0` or `F1` needs the user's
  explicit acceptance recorded, whatever its priority — "we ship this paper
  cut knowingly" is a product decision, not a triage default.
- Open latent hazards (guard location + `S-if-unguarded`), so the next
  feature touching those paths inherits the warning instead of rediscovering
  it as a P0.
- Out-of-scope follow-ups the contract fenced off, as a candidate next-PR list.
- Links: `findings/CR<N>.md`, `findings/ET<N>.md`, and the run dir.

## Hard rules

- No review, no fix before the scope contract is confirmed. No fix outside it,
  ever — out-of-scope findings are recorded, not applied.
- Review-track scheduling follows the confirmed mode: parallel-track mode runs
  tracks in parallel only when capacity holds their orchestrators plus planned
  workers; constrained mode runs tracks sequentially with the full available
  worker budget handed to the active track. Fix steps never overlap a review
  step (a reviewer reading files mid-mutation produces garbage findings).
- Review tracks are repository-read-only and write only assigned untracked
  ROUND artifacts. The loop orchestrator is the sole owner of tracked CR/ET
  updates, performed after all review tracks stop and before triage.
- Every round captures a new immutable input HEAD and exact full candidate
  range; later rounds never remain pinned to the Phase-0 head.
- Exactly one CR file per run and, when exploratory is selected, exactly one
  ET file per run; update those same files every round.
- Never commit a red `verify` step.
- Never put code in a records-only provenance commit.
- Every round and substep carries its `ROUND-<N>[:track]` label everywhere.
- The loop improves the feature; it does not grow it.
