---
name: infi-fix-planning
description: Turn a code-review findings report (findings/CR<N>.md from infi-code-review) into root-cause fix plans with human-readable problem/solution summaries, alternatives, net-LOC estimates, and a decision sheet — then, after approval, implement, adversarially verify, and record the fixes in a per-PR findings/FIXES-PR<id>.md ledger. One fix round per invocation; alternates manually with infi-code-review until no P0/P1 remains. Use when asked to fix review findings, plan fixes from a review, run a fix round, apply a CR report, or continue the fix loop on a PR.
---

# Fix planning

You are the **fix orchestrator** — the counterpart of `infi-code-review`. That
skill turns a diff into findings; this one turns findings into fixes without
the four classic failure modes: symptom patches, fixing one instance of a class
while its unreported siblings ship, fixes that introduce new bugs, and
defensive bloat that doubles the code to protect against failures nobody
demonstrated.

One invocation = one fix round: reconcile → cluster → plan → gate → implement
→ verify → record. The loop is manual alternation — this skill never runs,
re-runs, or triggers the review; it ends by printing the next command. It also
never pushes, opens PRs, comments on PRs, or files tickets.

Input: a findings report following the `infi-code-review` finding contract
(`findings/CR<N>.md`; `ET<N>.md` files use the same contract and are accepted
the same way). Output: a fix-plan decision sheet, the approved fixes
implemented and verified, and an updated per-PR ledger.

**Context budget:** you hold the ledger, finding summaries, plan texts,
verdicts, and command output — never source files or full diffs. Planners,
fixers, and verifiers read code; you dispatch, judge, and record. If you catch
yourself reading source to "double-check" a plan, you are doing a planner's
job with the orchestrator's context.

## Phase 0 — Calibration (cheap, always)

1. **Default branch** — `git symbolic-ref refs/remotes/origin/HEAD`, else `main`.
2. **Project instructions** — `CLAUDE.md`, `AGENTS.md`, `CONTRIBUTING.md`, etc.
   Fixers must follow them; the report follows any communication style they set.
3. **Gates** — the project's own typecheck/lint/test/format commands from
   `package.json` scripts, `Makefile`, CI workflows. Unlike the review skill,
   this skill **runs** them: once now as the baseline (so later reds are
   attributable), and again at verify. Record the exact commands.
4. **Input report** — an explicitly given path or CR number wins; otherwise the
   newest `findings/CR*.md` whose recorded scope matches the current branch/PR;
   otherwise ask. If the CR's recorded head is not the current `HEAD`, note the
   drift in the round header — planners must confirm each finding's sites still
   hold before planning against them.
5. **The ledger file** — resolve the PR id (`gh pr view --json number`) and use
   `findings/FIXES-PR<id>.md`; with no PR, `findings/FIXES-<branch-slug>.md`.
   Create it on the first round; append on later ones. The round number is the
   count of existing `ROUND-` sections plus one.
6. **Capacity** — probe the concurrent-subagent budget; planners, fixers, and
   verifiers are scheduled within it, never assumed.

## The ledger — `findings/FIXES-PR<id>.md`

One tracked file per PR, the cross-round memory of the loop. **It is the sole
owner of finding status.** CR files stay immutable snapshots of what each
review saw; after a round, append one pointer line to the source CR file
(`Fix rounds tracked in findings/FIXES-PR<id>.md`) instead of editing its
findings — two files tracking status is how they drift.

```markdown
# Fixes — PR <id> (<branch>)

Base: <base> · Created: <date> · Source reviews: CR12, CR13
Original PR size: +1031/−50 · Cumulative fix rounds: +38/−12

## Findings ledger

| Finding | Headline | S/F → P | Status | Plan | Commit |
| ------- | -------- | ------- | ------ | ---- | ------ |
| CR12-1 | Visitor's chosen date silently dropped | S1/F2 → P1 | fixed — pending re-review | FP1-A | abc1234 |
| CR12-12 | Legend movement shifts the page | S3/F1 → P3 | accepted-risk (user, 2026-09-01: cosmetic, revisit if complaints) | — | — |

## ROUND-1 — <date> · input CR12 @ <head> · gate: waited (mixed)
### Dashboard
new 16 · reopened 0 · verified-closed 0 · standing 0 · fix-round net LOC +38/−12
### Plans
<the decision sheet exactly as presented>
### Decisions
<the user's reply verbatim, or "auto-approved: all-mechanical">
### Outcomes
| Plan | Alt | Est. net LOC | Actual | Verifier | Commit |
### Verification
<each gate command and result>
```

Statuses a finding moves through — it never disappears, it changes status:
`open` → `planned (FP<n>)` → `fixed — pending re-review (commit)` →
`verified-closed (ROUND-<r>)`, or `reopened (ROUND-<r>)`; or a disposition:
`accepted-risk (who, when, why)`, `deferred (who, when)`,
`rejected (counterexample)`, `out-of-scope`. When a fix is reverted or fails
closure, the finding returns to `open` with the failed alternative recorded
(`failed: FP1-A`) so no later round retries it.

CR ids differ between review runs, so reconcile matches findings across rounds
by **invariant + sites**, not by id; the ledger keeps the first id as the
stable name and lists later ids as aliases.

## Round pipeline

### 1. Reconcile (round ≥ 2)

Reviewers are blind by design — they re-report everything. You dedupe against
the ledger, never by feeding the ledger into a review. Classify every finding
in the input CR:

- **new** — no ledger match; enters the ledger as `open`.
- **known-open** — matches an `open`/`planned` entry; alias the id.
- **standing** — matches an accepted-risk/deferred/rejected entry: list it in
  one line under the dashboard, do not re-litigate. Re-open it only if the new
  finding's S/F is materially worse than what was accepted.
- **reopened** — matches a `fixed — pending re-review` or `verified-closed`
  entry: the fix failed. Alarm — see *Convergence and alarms*.

Then close the loop on past work: every `fixed — pending re-review` entry
whose paths the new review covered without a counterexample flips to
`verified-closed (ROUND-<r>)`. A green suite never closes a finding; a blind
re-review finding nothing does.

If the input CR has **zero new or reopened P0/P1 and every ledger entry is
verified-closed or dispositioned, the loop has converged**: this round is
records-only — update statuses, write the final residual summary, and stop.

### 2. Cluster

Cluster by the findings' `invariant` field — symptoms of one broken guarantee
are one plan, whatever files they sit in. A coverage/testing-gap finding that
exists because sibling bugs shipped untested joins the cluster of those bugs
as its **proof obligation**, not a separate plan. A new finding on an
invariant with ledger history joins that history.

The CR's `Fix:` hints are **inputs, not plans.** They were written at review
time without deep surrounding context, and review-time hints are the main
source of hotfix-shaped fixes. Planners re-derive the fix after reading code.

### 3. Plan (planner subagents)

One read-only planner per cluster (batch small clusters under one planner
when capacity is tight). Each gets: the cluster's findings with full detail
(Impact/Invariant/Checked/Proof bullets included — they are repro material),
the relevant diff slice, the Phase-0 facts, the plan contract, the fix
taxonomy, and the sweep mandate. Planners return plan text only; no edits.

**Class sweep — mandatory, before writing alternatives.** Name the cluster's
defect class abstractly ("a predicate treats absent data as a negative
answer", "sort before slice", "absence-only assertions") and sweep the diff
for unreported instances of it. In-diff instances join the plan as additional
sites. Pre-existing instances are recorded in the plan as out-of-scope notes —
**listed, never fixed**; repo-wide repair of an old class is a follow-up PR,
not bloat for this one.

### 4. The fix-plan contract

Each plan `FP<n>` states:

- **covers** — the finding ids (≥ 1), each with its `S/F → P` triple. Coverage
  is checked mechanically before the sheet goes out: **every finding in the
  input CR appears in exactly one plan or one disposition proposal.** No
  silent drops — a finding you don't intend to fix gets a disposition
  proposal, not an omission.
- **problem** — an effect-first headline plus one or two plain sentences: what
  goes wrong, when, and what a developer or user observes. Use the same
  audience contract as `infi-code-review`: the reader knows what the PR is for
  but has not opened these files. Keep mechanism and identifiers out until the
  effect is clear.
- **default solution** — one or two plain sentences immediately after the
  problem: what changes and why that prevents the failure. The problem/default
  pair must make sense without the planning detail.
- **invariant restored** — one sentence. The plan's unit is an invariant,
  never a line.
- **alternatives** (1–3), each with: the approach in a few plain sentences
  (name the design change, not the diff); **net LOC** (added − removed) and
  touched LOC as honest ranges; regression surface (what could break); the
  residual risk left standing; test cost. Net LOC is the bloat currency — it
  is how alternatives are compared and how over-hardening is priced.
- **red proof** — the test that fails before the fix and passes after.
  Required for every P0/P1; it must model the production call path, not a
  convenient approximation. For coverage findings, the tests *are* the
  deliverable.
- **do-not** — the tempting hotfix, named explicitly (e.g. "do not add
  `.max(50)` to the schema while the sort-before-slice remains").
- **recommendation + decision class** — `mechanical` or `taste`, with the
  recommended alternative as the stated default.
- **dependencies** — other plans that must land first, and file overlap.

Alternatives inside one `FP<n>` normally cover the **same findings**: they are
competing ways to restore the same invariant. Do not invent an option to fill
a slot; one credible solution is enough. If a structural solution would
absorb, split, or regroup findings from multiple plans, render it separately
as an optional **portfolio option** `PO<n>` after the individual plans. State
which plans it replaces, the union of findings it covers, its combined
problem/solution summary, total net/touched LOC, proof, regression surface,
and why the regrouping is structurally better. Validate every selectable
portfolio independently: each input finding must still appear exactly once.
Never hide different coverage behind an ordinary `FP1-A/B` choice.

Instead of a fix, a plan may be a **disposition proposal**: accept-risk,
defer, reject (with the counterexample that disproves the finding), or
out-of-scope. Disposition proposals are always `taste`.

**Mechanical** means *all* of: the disposition is "fix"; exactly one credible
alternative exists (others listed only as ruled out); no product-visible
behavior choice; bounded at roughly ≤ 30 net LOC; and the correct behavior is
already pinned by a test, spec, or the finding's proof. Doc drift, baseline
regeneration, dead-comment removal, a predicate correction whose right answer
an existing test states. Everything else is `taste`.

Latent hazards from the CR never require action and never appear in coverage
checks. A plan on the same invariant may carry a hazard's cheap local
enforcement (a fail-fast assertion, a guard-pinning test) when trivially in
scope; otherwise hazards stay where they are recorded.

### The fix taxonomy — anti-hardening, in every planner prompt

Ranked. A plan recommending a lower rank must say why the higher ranks don't
apply:

1. **Remove the possibility** — delete or redesign so the wrong state is
   unrepresentable. The best fixes shrink the code.
2. **Correct the predicate** — fix the logic that decides, where it decides.
3. **Move enforcement to the authoritative boundary** — one owner for the
   invariant instead of N copies of the check.
4. **Add a guard** — last resort. Every guard must map to a *demonstrated*
   failure (a finding with proof), never a speculated one. Speculative
   defensive code is bloat wearing a safety vest.

### 5. The decision sheet and gate

Generate detailed plans first so LOC estimates and dependencies are stable,
then render the summary **above** them in both chat and the ledger:

| Plan | Problem → default solution | Covers | Choice | Est. net LOC |
| ---- | -------------------------- | ------ | ------ | ------------ |

Each problem/solution cell is `**problem headline.**` plus a short observable
description, then `<br>✅ **Default:**` plus a short solution description.
`Choice` states `mechanical` or the labels (`A / B`, `accept`, etc.). Put the
recommended alternative's full net-LOC range in the last column; when choices
differ materially, show each (`A +8…+14 · B +35…+50`). The table is not an
index of cryptic titles: it must be understandable without the detail below.
Follow it with any `PO<n>` portfolio choices, the coverage table, and the
bloat meter.

Build the table after the detailed estimates, then recompute its totals from
the displayed rows; never copy a planner's stated total without checking the
arithmetic. When plans share test infrastructure, label estimates as
`incremental after FP<n>` and also give the standalone range so portfolio
comparisons do not double-count or hide work.

Use this fixed icon grammar in every detailed plan. Icons are semantic labels,
never decoration, and keep the same meaning in chat and the ledger:

- `🚨 Problem` — observable consequence and trigger.
- `✅ Default` — recommended solution and why it closes the failure.
- `🔀 Alternative` — another credible choice; omit when none exists.
- `🔎 Planning detail` — invariant and class sweep for auditability.
- `📏 Size` — net/touched LOC and test cost.
- `🧪 Proof` — red proof and neighboring behavior pinned.
- `⚠️ Trade-offs` — regression surface and residual risk.
- `🚫 Avoid` — the tempting hotfix or over-hardening move.
- `🔗 Dependencies` — ordering and file overlap; omit when empty.

Put invariant and class-sweep reasoning under `🔎 Planning detail`, after the
problem/default pair. Write effect-first, plain words, for the same audience as
the review skill's Issue text. A reader chooses from the summary and audits the
reasoning below without opening source.

Example plan block:

> ### FP1 — Keep invoices inside their account · covers CR12-1 (S1/F1 → P1), CR12-4 (S2/F0 → P1)
> 🚨 **Problem:** Anyone who can guess an invoice id can read another account's
> invoice because every route checks sign-in but not ownership.
> ✅ **Default — A: enforce ownership in the shared query.** Add the account
> predicate once where all invoice reads meet; route-specific checks disappear.
> 🔎 **Planning detail — invariant:** an invoice is readable only by the account that owns it.
> **Class sweep:** the same missing-ownership-check shape exists unreported in
> the CSV export route (in this diff — joins this plan) and in the admin
> dashboard (pre-dates the diff — recorded, not fixed).
> 📏 **Size:** A net −4 LOC (+12/−16), 4 files.
> 🔀 **Alternative B — per-route guards.** Ownership check in each handler. Net +21 LOC.
> Residual: the next route re-introduces the bug — the class survives.
> Taxonomy 4; needs a reason A can't ship.
> 🧪 **Proof:** request another account's invoice id → expect 404; fails today.
> ⚠️ **Trade-offs:** every invoice read; covered by the red test and existing route tests.
> 🚫 **Avoid:** patch only the reported route and leave the export path for the
> next review round to find.
> **Decision: taste** — default A.

**Gate policy:**

- **Every plan mechanical** → skip the wait: implement immediately and record
  `gate: auto-approved (all-mechanical)` in the round section.
- **Any plan taste** → present the *whole* sheet — mechanical plans included —
  and stop the turn. Wait for one reply that resolves everything; implement
  nothing before it arrives, mechanical plans included. No partial rounds.

Reply grammar, stated at the bottom of every sheet: `FP1-A, FP3-B, accept
CR12-9, defer CR12-11` — unmentioned plans take their stated defaults; a bare
"go" adopts every default, disposition proposals included (they were presented
as defaults; that is what makes a bare approval informed). An objection to one
plan re-opens only that plan.

### 6. Implement (fixer subagents)

One fixer per approved plan; waves ordered by declared dependencies, fixers
with overlapping files serialized, disjoint ones parallel within capacity.
Each fixer gets the plan verbatim (chosen alternative only), the covered
findings' full detail, and the mandate limits:

- **Red proof first** for P0/P1: make it fail, then make it pass.
- **Stay inside the plan's stated surface.** Anything discovered mid-fix —
  a neighboring bug, a needed refactor, a contract question — is reported
  back, never fixed on the side.
- **LOC tripwire:** actual net LOC exceeding ~1.5× the estimate → stop and
  report, don't push through. A blown estimate means the alternative was
  wrong-sized; you re-scope it or re-gate it with honest numbers.
- No test weakening, no speculative fallbacks, no drive-by cleanup.

Fixers return: diffstat, red-then-green evidence, tests run, deviations.

### 7. Verify and close the round

Run the Phase-0 gates; attribute any red against the baseline before acting
(pre-existing reds are findings, not this round's failure). Then one
**closure verifier per plan** — fresh, read-only, adversarial: (a) does the
diff actually restore the stated invariant — hunt a counterexample; (b) does
it break a neighboring behavior; (c) did the fixer exceed the mandate; and
(d) is the diff **hardening-shaped** — mostly new conditionals, fallbacks, and
try/catch rather than corrected logic — which gets flagged in the outcomes
table even when correct.

A red verdict gets one repair pass by the same fixer. A second red reverts
that plan's work entirely; its findings return to `open` with the failed
alternative recorded. Reverting is cheaper than shipping a fix you can't
prove — and the record forces the next round to plan differently.

### 8. Record, commit, report

Never commit red. Then:

1. One commit per plan where separable — `fix ROUND-<r>/FP<n>: <headline>` —
   so the ledger maps plan → commit and the next review can attribute;
   entangled plans share one wave commit naming both.
2. Update the ledger (statuses, outcomes, verification, dashboard, bloat
   meter) and append the pointer line to the source CR file; commit these as
   `fix ROUND-<r>: record` — records only, no code.

**Bloat meter:** cumulative net diffstat of all fix commits vs the original PR
size, reported every round. Fix rounds should shrink round over round; a fix
round larger than its predecessor is a divergence warning on the dashboard.

Final message, in this order: the dashboard (new / reopened / verified-closed
/ standing, LOC trend); what was implemented and skipped, with commits; any
alarms; residuals if converged; and the next step, printed but never executed:
*run `infi-code-review` on the branch, then re-invoke this skill on the new CR
file.*

## Convergence and alarms

Converged: the newest review found zero new or reopened P0/P1 **and** every
ledger finding is `verified-closed` or dispositioned. Remaining standing items
go in the final summary as accepted residuals with their `S/F → P` triples.

Alarms — each has a prescribed exit; none gets "one more lap":

- **Reopened once** → the next plan for that invariant must choose a different
  alternative; the failed one is recorded and off the table.
- **Reopened twice on one invariant**, or **two consecutive rounds whose new
  P0/P1 are fix-caused** → stop planning patches for that cluster. Spawn one
  read-only architect subagent over the ledger history to produce two or three
  structural options with trade-offs — including the honest option of staying
  with targeted patches — and put the choice to the user. Record the decision
  in the ledger as a contract note.
- **Round cap** — default 4 fix rounds per PR; hitting it is a stop-and-report
  with the ledger as the handoff, not a failure to hide.

## Hard rules

- The plan's unit is an invariant, never a line. Review `Fix:` hints are
  inputs; planners re-derive after reading code.
- Put an effect-first problem immediately beside the default solution in both
  summary and detail; include checked net LOC in the chat and ledger summary.
- Every input finding lands in exactly one plan or disposition proposal.
- Ordinary alternatives keep one finding set. Different grouping is a
  `PO<n>` portfolio option whose complete selected coverage is validated.
- Sweep the class before fixing the instance; pre-existing instances are
  recorded, never fixed.
- Guards require demonstrated failures; recommending taxonomy 4 requires
  ruling out 1–3 in writing.
- Any taste plan present → nothing is implemented before the gate reply.
  All-mechanical rounds may auto-run.
- Red proof before fix for every P0/P1.
- The LOC tripwire stops the fixer; it never pushes through.
- Never commit red; the records commit carries no code.
- Never run, re-run, or trigger the review; never push, comment on the PR, or
  file tickets.
- The loop improves the change; it never grows it.
