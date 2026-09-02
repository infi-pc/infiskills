---
name: infi-code-review
description: Multi-reviewer code review of a diff (PR, branch, commit range, or working tree) that fans out focused read-only subagents (correctness, testing, maintainability, security, performance, ...), verifies findings against counterexamples, and produces a priority-ranked report (P0-P3 computed from a severity × frequency risk matrix, findings carry the full S/F → P triple) plus a durable findings/CR<N>.md record. Use whenever asked to review code, review a PR/branch/diff/commit, check whether a change is merge-ready, or find defects in changed code — and as the code-review track inside the infi-review-loop skill.
---

# Code review

Find real, actionable defects in changed code. Prefer a short, high-signal
report over exhaustive commentary. You are the **review orchestrator**: you
scope the diff, fan out focused reviewer subagents, then verify and synthesize
their findings yourself. Reviewers find; you judge.

This skill is project-agnostic. Everything it needs to know about *this* project
— test commands, conventions, the default branch, where findings live — is
discovered in Phase 0 below, not hardcoded here.

## Phase 0 — Project calibration (cheap, always)

Before dispatching anyone, establish these five facts and carry them into every
reviewer prompt. Get them from files and commands, not by reading source into
your own context.

1. **Default branch** — `git symbolic-ref refs/remotes/origin/HEAD` or
   `gh repo view --json defaultBranchRef`. Fall back to `main`.
2. **Project instructions** — read whichever of `CLAUDE.md`, `AGENTS.md`,
   `CONTRIBUTING.md`, `.cursorrules`, or `docs/` conventions files exist at the
   repo root or in the changed packages. These define the `project-standards`
   lens; without them that lens has nothing to check against.
3. **Stack and gates** — infer the language/framework and the project's own
   checks from `package.json` scripts, `Makefile`, `justfile`,
   `pyproject.toml`, `Cargo.toml`, `go.mod`, or the CI workflow files. You do
   not run them (that is the review-loop's `static` track), but reviewers need
   to know what the project considers a violation.
4. **Findings directory** — default `findings/` at the repo root. If the project
   instructions name a different location for review records, use that. If the
   project is not a git repo or is read-only, say so and skip the durable record.
5. **Reviewer capacity** — the number of subagents you can hold concurrently.
   See *Reviewer subagents*.

If the project instructions specify a communication style for reports (audience,
format, decision structure), follow it for the final summary. Otherwise use the
report format defined below.

## Scope

1. If a PR, branch, or `base:<ref>` is provided, review that diff; otherwise
   review the current branch against its merge base with the default branch.
2. Do not switch branches, push, open PRs, or file tickets.
3. Review tracked changes by default. Mention untracked files only if they
   appear relevant.
4. Infer intent from the request, PR title/body, recent commits, plan docs, and
   the diff. Do not block on questions unless scope is impossible to infer.
5. **Loop mode:** when invoked by the `infi-review-loop` skill you will be handed
   a scope contract, round label, immutable round input head, exact full
   candidate range, an optional previous-round focused delta, an existing
   stable finding inventory, an untracked ROUND artifact path, and the worker
   capacity available to this track. Honor that handed capacity as well as the
   fixed product scope while reviewing the exact current candidate. Write the
   complete report only to the assigned artifact under the run directory; do not
   allocate, create, or edit `findings/CR<N>.md` or any other tracked file.
   Reference an existing CR ID when evidence is clearly a follow-up; give new
   findings round-local candidate IDs for the loop orchestrator to map. End
   your reply with the raw findings table. The loop orchestrator alone merges
   the artifact into the run's preallocated durable CR record and owns stable
   ID allocation, resolution labels, and fixing commit hashes.

## Durable record — standalone mode

Outside review-loop mode, every review leaves a tracked record: scan the
findings directory for `CR*.md`, allocate the next number above the highest
existing suffix (never fill gaps or overwrite), and write `findings/CR<N>.md`
before your final response. Follow-ups to the same review update that file —
including recording which findings were later fixed, with the fixing commit.

The record is the primary handoff, so it must stand alone: review date, exact
scope/base/head or commit identifiers, the verdict, what coverage or validation
was performed, every finding with its full metadata and evidence, open
questions, assumptions, unreviewed areas, and an explicit `No findings` section
when the review is clean. Never leave the only detailed review in chat or in a
gitignored directory.

In review-loop mode, do not run this allocation procedure or edit any durable
record; the loop orchestrator's Phase 0 allocation and post-review records step
are authoritative.

## Reviewer subagents

First establish this track's reviewer capacity. In loop mode, use the worker
capacity handed by the loop orchestrator; do not invent a larger fan-out. Full
capacity means the handed budget can hold one reviewer for every warranted
focus at once; any smaller budget is constrained mode. Dispatch read-only
reviewers by that mode:

- **Full-capacity mode:** spawn one fresh subagent per warranted focus in
  parallel. Give each exactly one focus.
- **Constrained mode:** combine compatible mandatory lenses into fewer fresh
  reviewers so the dispatch fits the handed capacity. Assign each reviewer an
  explicit, disjoint lens group and require separate findings checks for every
  lens in that group. Cover every mandatory lens; combine warranted optional
  lenses the same way rather than dropping them. Each reviewer starts with a
  fresh context and is used once — never resume a completed reviewer for a
  second lens.

Give every reviewer the diff, inferred intent, changed-file list, the Phase-0
project calibration facts, scope contract if in loop mode, and assigned focus or
lens group. They return findings only — no fixes, no summaries.

Hand them the finding contract including `headline` and `summary`, and tell them
plainly: state the *effect* first, in words someone who has not opened the file
can follow, and keep the mechanism, call chain and identifiers in `why`. A
reviewer that reports only a mechanism (`X conflates A and B`) forces you to
reconstruct the consequence from scratch, and reconstructions are where wrong
severity comes from.

Always cover these lenses (this requires four reviewer processes only in
full-capacity mode):

- **correctness** — logic bugs, edge cases, state, error handling, intent
  mismatch.
- **testing** — missing or weak tests for changed behavior.
- **maintainability** — unnecessary complexity, coupling, dead code, risky
  abstractions.
- **project-standards** — violations of the project instruction files found in
  Phase 0, plus the project's conventions, type discipline, i18n and
  design-system rules, and layering rules.

Add focused reviewers only when the diff warrants them:

- **security** — auth, permissions, secrets, user input, public endpoints,
  injection, deserialization, SSRF.
- **performance** — data-store access and query shape, N+1s, network chatter,
  caching, loops over large data, async/concurrency, allocation in hot paths.
- **api-contract** — routes, serializers, exported types, schemas, wire
  protocols, event payloads, external interfaces, semver surface.
- **reliability** — retries, timeouts, background jobs, idempotency, partial
  failure, durability of persisted state, offline/degraded behavior.
- **data-migration** — migrations, schema changes, backfills, data transforms,
  forward/backward compatibility during rollout.
- **frontend** — UI state, accessibility, responsiveness, race-prone
  interactions.
- **infrastructure** — IaC, container and deploy config, secrets handling,
  permissions/roles, resource limits.
- **adversarial** — large or high-risk changes; try to break the feature from
  the user/operator perspective.

## Finding contract

Each finding includes:

- `severity` (S): how bad one hit is — `S0` data loss/corruption, exploitable
  vulnerability, critical breakage · `S1` user-facing bug, contract break,
  serious operational risk · `S2` meaningful edge case, performance issue,
  maintainability trap, missing coverage · `S3` low-risk polish.
- `frequency` (F): how often realistic usage crosses the failure path —
  `F0` every-use (normal use of the feature hits it) · `F1` common (typical
  workflows hit it regularly) · `F2` occasional (specific but realistic
  conditions) · `F3` rare (unusual timing, narrow race, exotic state).
  Derive it from the triggering conditions, not gut feel: name what must be
  true for the path to execute. Severity and frequency are independent
  measurements; neither is ever adjusted to get a nicer priority.
- `priority` (P): computed from the standard risk matrix, never assigned by
  feel:

  |        | F0 | F1 | F2 | F3 |
  | ------ | -- | -- | -- | -- |
  | **S0** | P0 | P0 | P0 | P0 |
  | **S1** | P0 | P1 | P1 | P2 |
  | **S2** | P1 | P2 | P2 | P3 |
  | **S3** | P2 | P3 | P3 | P3 |

  The S0 row never discounts — rare data loss is still P0. `S1/F0` promotes —
  a bug every user hits every session is drop-everything. The three metrics
  travel together **everywhere** — tables, CR records, prose, fixer handoffs —
  written `S<n>/F<n> → P<n>`; a bare `P1` hides whether it is a rare
  catastrophe or a constant paper cut, and that difference decides the fix.
- `invariant`: one clause naming the guarantee the code breaks ("a save
  receipt is retired only after bytes are durably persisted"). This is the
  clustering key for root-cause analysis — symptoms share an invariant, not
  necessarily a file.
- `merge_gate`: `blocks` (must fix before merge), `conditional` (merge only
  with explicit acceptance or follow-up), `non_blocking`.
- `blast_radius`: `single-user`, `tenant`, `all-users`, `ops-only`,
  `developer-only`, or `unknown`.
- `headline`: the defect in **plain words**, ≤ 8 words, as a claim. This is what
  a reader skims, so it names the consequence, not the mechanism.
- `summary`: one or two sentences saying what goes wrong, under what
  circumstances, and what the reader would observe. Together with the headline
  and the sites this is the whole Issue cell — it must stand on its own without
  the detail bullet.
- `sites`: the `file:line` locations, rendered on their own line **below** the
  summary inside the Issue cell — never as a separate table column. A narrow
  column wraps a long path into a vertical stack of character fragments that is
  both unreadable and wider than the path itself. One line, comma-separated,
  most relevant first; list several when a cluster genuinely spans sites and
  cap it at three, leaving the rest to the **Invariant** bullet.
- `why` (observable impact, not style), `fix` (concrete recommendation).
- `confidence`: `50` plausible but not fully provable · `75` verified against
  surrounding code, likely affects real usage · `100` mechanically certain
  from code, tests, types, or an explicit project rule.

### Writing the Issue text

Write for a developer who knows **what the change is for** but has never opened
these files. They cannot resolve a private identifier, a helper name, or an
internal flag from memory — a headline built out of those is unreadable to
everyone except the author, which is precisely the audience that does not need
the review.

So: lead with the effect, then explain the mechanism only as far as the reader
needs it to judge the finding. Reviewers hand you the mechanism; converting it
to audience-facing language is **your** job as orchestrator, and you do it in the
first draft rather than on request.

Rules that carry most of the weight:

- **Headline = consequence.** What breaks, who notices. Never open with a bare
  symbol name as the subject.
- **Name symbols only when they are the clearest available words**, and only
  after the effect is established. The location line already tells the reader
  where to look, so the text rarely needs the identifier at all.
- **Put the location last, on its own line.** It is a jump target, not part of
  the sentence — a reader scanning for meaning should hit the claim first and
  reach the path only once they have decided they care.
- **Say when it happens.** A finding with no triggering condition reads as
  either always-broken or hypothetical. The condition is already in your `F`
  measurement — reuse it.
- **Prefer the observable to the internal.** "the widget opens on a different
  day" beats "`dateToPreselect` is withheld".
- **Do not restate the fix as the issue**, and do not compress two sentences of
  mechanism into one unreadable one. Mechanism detail belongs in the bullet.
- **Say if the cause pre-dates the diff** when the diff only adds instances of
  it, so the reader can price it correctly.

Before → after, on real findings:

| Don't (mechanism-first, unreadable cold) | Do (effect-first, stands alone) |
| ---------------------------------------- | ------------------------------- |
| `contradictedByGrid` conflates "denied" with "not in view" | **Visitor's chosen date is silently dropped.** If they page to a different month before hitting Search, the block decides its calendar never confirmed the date and sends nothing downstream — so checkout opens on a day of its own choosing, while the UI still shows the visitor's date. |
| Dropping destination/category for picked ids removes the only fallback scope | **Picked-products block can open checkout against the whole catalogue.** Choosing specific products drops the category scope. If those products later fail to load, nothing is left to fall back on, so checkout opens unfiltered. |
| `normalizeProductIds` sorts before slicing | **Past 50 picks, the wrong products get dropped.** The list is sorted before being trimmed to 50, so the survivors are whichever ids sort lowest — effectively random for UUIDs. An author's first pick can vanish while their 55th survives. |
| Missing baselines for the new template id | **New test template ships without its screenshots.** It needs three baseline images that are not in the branch, so three visual tests fail on every run. That leg is advisory, so it will not block the merge button — it just stays red on every future PR. |
| `expect(requests).toEqual([])` is racy | **The headline perf claim is guarded by a test that can pass vacuously.** "No request was made" is asserted immediately, with nothing making it wait for a request that may still be on its way. |

Suppress findings that are: style issues a formatter/linter would own; generic
"consider" advice without a concrete failure mode; pre-existing issues not made
worse by the diff; made impossible by *local* structure (the type system, the
immediate caller) — that is not a bug at all; personal preference not backed
by project instructions or user impact.

**Latent hazards — serious in isolation, unreachable today.** When the
counterexample check shows the failure is real in the code but prevented only
by a *remote* precondition — an entry-point gate, middleware, another
package's discipline — neither file it as a live bug nor drop it. Reclassify
it as a `latent hazard` with: the exact guard that makes it unreachable
(file:line), `S-if-unguarded` (the severity if that guard fell), the
unguarding trigger (a new caller, a new entry point, a guard refactor), and
the cheapest local enforcement (a fail-fast assertion at the vulnerable site,
or a test that pins the remote guard). Latent hazards carry no priority and
never gate the verdict — filing unreachable code as S0 is crying wolf, and a
loop that fixes wolves never converges. But they are not noise either: the
common failure story is a P0 that reopens because a *new* entry point bypasses
a guarantee only one path enforced — a bug that spent its life as an
unrecorded latent hazard before it became real. They get their own section in
the report and the CR record, clustered by invariant like everything else.

## Synthesis

Before reporting:

1. Deduplicate overlapping findings.
2. Cluster by invariant: findings that violate the same guarantee are one
   root-cause cluster, not N independent bugs. Present a cluster as one lead
   finding with every known symptom site listed, and make the recommended fix
   cause-level — restore the invariant — not a per-site patch. Then hunt the
   cluster's *missing* symptoms: walk the other code paths that touch the same
   invariant (other callers, the composed/manual variant of an automatic path,
   error branches) and check whether they violate it too. A cluster reported
   with only the symptoms that happened to be found is how "fixed" bugs come
   back under a new repro.
3. Run a counterexample check: identify what nearby code path, guard, caller,
   middleware, test, or config would make the finding false, then inspect it.
4. Verify each surviving finding against the code yourself.
5. For every P0 and confidence-100 P1, include proof: a `red_test` (failing
   test to add before the fix), a `repro` (exact manual/API/UI steps, command,
   query, or observability check), or `reason_unprovable`. If no proof is
   available, reconsider severity or confidence.
6. Drop findings below confidence 75, except important P0/P1 risks worth
   surfacing with explicit uncertainty.
7. Separate pre-existing issues from diff-introduced issues.
8. Recalibrate severity, frequency, and merge gate after deduplication, then
   recompute priority from the matrix; sort by priority, then confidence,
   then file path.

## Report format

Lead with findings. If there are none, say so plainly and mention residual
test gaps or risks. Group by `### 🔥 P0 — Critical`, `### 🔴 P1 — High`,
`### 🟠 P2 — Moderate`, `### 🔵 P3 — Low`; omit empty sections.

```markdown
## Review Results

**Scope:** <diff scope> · **Intent:** <what the change does>
**Reviewers:** correctness, testing, ...

### 🔴 P1 — High

| #   | Issue                                                                                                                                                                                                                             | Gate   | S/F → P    | Blast radius | Reviewer | Confidence |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ---------- | ------------ | -------- | ---------- |
| 1   | **Anyone can read another customer's invoices.** The endpoint checks that you are signed in but never that the invoice is yours, so changing the id in the URL is enough.<br>`app/api/invoices/[id]/route.ts:42`, `lib/auth/guard.ts:88` | blocks | S1/F1 → P1 | tenant       | security | 100        |

- **#1** — **Impact:** <observable impact>. **Invariant:** <guarantee broken;
  other sites in the cluster, if any>. **Checked:** <counterexample inspected>.
  **Proof:** <red test/repro/reason unprovable>. **Fix:** <concrete fix>.

### 🛡️ Latent hazards — guarded upstream, no priority

- **L1** — `path/g.ts:88` — <would-be failure>. **Guarded by:** <file:line>.
  **S-if-unguarded:** S0. **Unguarded by:** <new caller/entry point>.
  **Local enforcement:** <assertion or guard-pinning test>.

### 🧪 Testing gaps
### ⚠️ Residual risks

> **Verdict:** ✅ Ready to merge | 🟡 Ready with fixes | ⛔ Not ready
```

Rules:

- The Issue cell is `**headline.** summary<br>`file:line`` per *Writing the
  Issue text* — a bold plain-words claim, one or two sentences a reader can act
  on without opening the file, then the location(s) on their own line. Three or
  four lines of table cell is the right size; a terse fragment that only the
  author can parse is not. Everything past that — mechanism, call chain,
  identifiers, the counterexample you ruled out — goes in the keyed bullet, with
  bold labels in this order: **Impact**, **Invariant**, **Checked**, **Proof**,
  **Fix**.
- **There is no `File` column.** Locations live in the Issue cell (see `sites`).
  Keep the remaining columns to the ones that are short by nature — `#`, `Gate`,
  `S/F → P`, `Blast radius`, `Reviewer`, `Confidence` — so the Issue cell gets
  the width, and drop `Blast radius`/`Reviewer` from lower-priority tables when
  they add nothing.
- A root-cause cluster is one numbered finding: the lead site first in the cell's
  location line, the other symptom sites after it (up to three) with the full
  list and the reasoning in the **Invariant** bullet, severity/frequency taken
  from the worst symptom.
- Never strip the triple: every finding carries `S<n>/F<n> → P<n>` in the
  table, the CR record, and any prose or handoff that names it. Sections
  group by the computed P.
- Standalone mode uses stable finding numbers everywhere (`CR<N>-1`,
  `CR<N>-2`, ... in the CR file). In loop mode, preserve handed existing IDs
  and use round-local candidate IDs for new artifact findings; the loop
  orchestrator assigns their durable CR IDs.
- Exact file and line for every code finding, inside the Issue cell. No time
  estimates.
- Do not apply fixes unless explicitly asked. If asked to fix a P0 or
  confidence-100 P1, write the red failing test first, then make it green.
- Standalone runs: after writing the CR file, summarize for the requester —
  verdict and counts in the terms their project instructions ask for (product
  terms if the audience is non-technical), and link the CR file as the primary
  handoff. Loop mode writes the complete report to its assigned untracked
  artifact and skips the human summary and all tracked record edits.

## Final gate

Before delivering, re-check that every finding is actionable, diff-related,
accurately cited, severity-calibrated, plausible to fix in this codebase, and
not duplicate, speculative, or lint-only.

Then read the Issue column once as the recipient, not as the author: for each
row, would a developer who knows the change's purpose but has never opened that
file understand what breaks and when, from the cell alone? Any row whose subject
is a bare identifier, or that only makes sense if you already know the
implementation, gets rewritten now — not when someone asks for it. The table is
what most readers will read; a finding they cannot parse is a finding you did
not report.
