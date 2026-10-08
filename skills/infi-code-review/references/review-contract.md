# Shared review and fix contract

Read this when reviewing findings, planning fixes, or coordinating a review loop.
It owns the evidence, risk, disposition, and closure definitions used by those
skills. Skill-specific presentation and execution instructions stay in their
respective `SKILL.md` files.

## Establish the guarantee and consequence

Each finding carries these facts; combine them into plain sentences rather than
creating a separate table column for every field:

- **Identity and scope:** stable finding ID, exact base/candidate revision,
  relevant `file:line` sites, and whether the change introduced or worsened it.
  For uncommitted work, preserve the diff and relevant untracked content as a
  reproducible candidate snapshot; a HEAD hash alone does not identify it.
  Candidate matching concerns reviewed product, tests, configuration, and docs;
  workflow evidence/record updates alone do not change that candidate.
- **Guarantee:** one `invariant` clause, the supported workflow it protects,
  and its basis: user decision, public documentation, test/spec, or inference.
  An inferred expectation is an open contract question until justified. Do not
  invent support commitments, or declare advertised behavior unsupported to
  dispose of a finding.
- **Consequence:** an effect-first `headline` and short `summary` stating the
  trigger, what goes wrong, who notices, and recovery/workaround options.
- **Reach:** the affected population and triggering conditions. Distinguish
  evidence from assumptions; record unknown prevalence as unknown. A failure
  on every use of one interface does not mean every user encounters it.
- **Evidence:** mechanism and impact (`why`), inspected counterexamples,
  reproduction or failing test, and exactly which checks were actually run.
  Label proposed tests and unexecuted repro steps as such.
- **Direction:** a concrete `fix` hint where justified, clearly provisional
  when a product or trust-policy decision remains unresolved.

For a maintainability finding, demonstrate the cost of an ordinary future
change: which callers must coordinate, representations must agree, or checks
must be duplicated. File length alone is not a defect. Optional redesigns
without a demonstrated maintenance cost belong in proposals, not merge blockers.

## Calibrate risk separately from the fix decision

**Severity (S)** measures the consequence of one occurrence:

- **S0:** catastrophic impact, such as substantial irreversible data loss,
  broad sensitive-data compromise, or critical system-wide failure. Security
  findings qualify through demonstrated impact, not the word "exploitable".
- **S1:** substantial failure of a supported workflow, consequential contract
  violation, or serious security/operational harm.
- **S2:** limited or readily recoverable failure, meaningful edge case,
  performance issue, demonstrated maintenance trap, or consequential test gap.
- **S3:** minor inconvenience or polish.

**Frequency (F)** is conditional on a named workflow/population: **F0** every
use, **F1** common in typical use, **F2** occasional under specific realistic
conditions, **F3** rare timing or unusual state. State the conditions and basis
for the estimate; mark it provisional when evidence is weak. Code certainty
does not establish user prevalence. For maintenance findings, estimate how
often the demonstrated change task arises, not how often the code executes.

**Priority (P)** is a triage ranking computed from this matrix:

|        | F0 | F1 | F2 | F3 |
| ------ | -- | -- | -- | -- |
| **S0** | P0 | P0 | P0 | P0 |
| **S1** | P1 | P1 | P1 | P2 |
| **S2** | P2 | P2 | P2 | P3 |
| **S3** | P3 | P3 | P3 | P3 |

Carry `S<n>/F<n> → P<n>` in finding tables, durable records, and handoffs.
Preserve historical ratings; record evidence-backed recalibration separately.
Never lower severity because a fix is expensive. Frequent limited failures
deserve attention without automatically becoming emergencies.

**Confidence** concerns the defect claim under the stated conditions: **50**
plausible but unresolved, **75** verified against surrounding code with some
uncertainty, **100** mechanically established by code, types, tests, or a
specific project rule. Record uncertainty about reach separately.

**Blast radius:** `single-user`, `tenant`, `all-users`, `ops-only`,
`developer-only`, or `unknown`; this describes the reach of an occurrence,
not the percentage of users who trigger it.

**Merge gate:** `blocks`, `conditional`, or `non_blocking`, with a short reason
connecting the consequence and evidence to an agreed release guarantee.
Priority alone never selects a fix or grants permission to accept risk.
Missing coverage is a blocker when it leaves a required guarantee unverified;
state that verification gap without claiming an unproven production failure.

## Keep one status owner

- **Standalone review:** CR/ET reports record what a particular review saw.
  Follow-up evidence may be appended with its revision; preserve earlier
  observations. Once a FIXES ledger exists, point to it for current status.
- **Standalone fix round:** `findings/FIXES-PR<id>.md` (or branch equivalent)
  owns current status, decisions, and closure evidence. Source review reports
  receive a pointer, not a second mutable status table.
- **Review loop:** the loop orchestrator alone owns current status in its
  allocated CR/ET records. `loop.md` holds scope, scheduling, and decision
  history and links to those records; it does not duplicate their status
  tables. Inner skills return artifacts, never create a competing FIXES ledger
  or commit records. If importing earlier standalone work, preserve its IDs
  and history and mark that ledger as superseded by the loop's records.

Use `open` → `planned` → `fixed — pending verification` → `verified-closed`,
or `reopened`. Existing `fixed — pending re-review`, `verified closed`, and
`closure invalidated` labels map to the corresponding states; do not rewrite
historical snapshots merely to normalize spelling.

Dispositions: `accepted-risk` (who, when, consequence accepted, revisit trigger),
`deferred` (who, when, why, revisit trigger), `rejected` (counterexample), or
`out-of-scope` (boundary and reason). Authorization may come from an explicit
decision or an already agreed triage policy; cite it. Deferring a blocker does
not make the release ready unless its residual risk is authorized. An optional
proposal may remain a follow-up without being called an accepted live defect.

## Close findings with affirmative evidence

Closure requires all of:

1. The exact candidate revision/snapshot and the original reproduction or an
   equivalent check, its actual result, and any remaining verification limits.
   For documentation or maintenance-only corrections, an explicit inspection
   of the claimed change can be the equivalent check; do not invent a unit test
   that merely mirrors wording or implementation.
2. A fresh verifier's explicit assessment of the guarantee, relevant sibling
   entry points, and neighboring behavior. Give the verifier the guarantee,
   scope decisions, original evidence, and candidate, without the fixer's
   conclusion as an expected answer. A covered file or a silent review is
   insufficient. A green general suite alone is also insufficient.
3. Verification of the implemented maintenance tradeoff: actual ownership,
   caller obligations, and added/removed coordination match the accepted plan.

A fresh closure verifier may satisfy this within the same fix round; another
whole-PR review is not automatically required. Report closure as bounded to
what was examined. Later changes that affect the guarantee invalidate the
relevant evidence and require renewed verification; records-only commits do
not invalidate unchanged code evidence. Associate a tested snapshot with its
commit only after checking the product/test content matches.

## Diagnose recurrence and decide when to stop

Match history by guarantee and sites, preserving IDs and aliases. Before
choosing a new solution, distinguish an incomplete correction, a later
regression, a changed guarantee, and a design that cannot enforce the existing
guarantee. Record the causal evidence. A new symptom does not automatically
invalidate the previous design, and recurrence does not ban completing it.

Stop successfully when agreed release guarantees have current evidence and
remaining findings have authorized dispositions. New suggestions enter triage;
they do not automatically expand the release. A round cap or missing evidence
is a stop with unresolved work reported, never a claim of convergence.
