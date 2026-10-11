---
name: infi-code-review
description: >-
  Multi-reviewer code review of the open pull request on the current branch.
  Fans out read-only focus reviewers (correctness, testing, maintainability,
  project-standards, plus conditional security / performance / api-contract /
  reliability / data-migration / frontend / multi-tenancy / i18n / adversarial),
  verifies findings against counterexamples, and reports a priority-ranked table
  with a merge verdict — P0-P3 computed from a severity × frequency risk matrix,
  with the S/F measurement kept in each finding's detail. Use when the user says
  "review", "review my changes", "review this PR", "code review", "review before
  I open the PR", "is this ready to merge", or names a branch/PR/base ref to
  review. Reports findings only — does not apply fixes unless explicitly asked.
---

# Code Review

## Goal

Find real, actionable defects in changed code. Prefer a short, high-signal report over
exhaustive commentary. You are the **review orchestrator**: you scope the diff, fan out
focused reviewer subagents, then verify and synthesize their findings yourself. Reviewers
find; you judge.

## Scope

1. If the user names a PR, branch, or `base:<ref>`, review that diff. Otherwise resolve the
   open pull request on the current branch. For a PR, record its number and full base/head
   SHAs before reviewing (pass the explicit PR selector when one was supplied):
   ```bash
   gh pr view --json number,state,baseRefName,baseRefOid,headRefOid,title,body,url
   ```
   Require `state=OPEN` for the default PR target. If the branch has no open PR, discover
   the repository default with
   `git symbolic-ref refs/remotes/origin/HEAD` or `gh repo view --json defaultBranchRef`,
   and pin that base and the local `HEAD`. Record that assumption. Use `main` only when no
   default can be discovered. Explicit branch/base targets also resolve to full SHAs once.
2. Fetch missing commit objects from the appropriate remotes without changing the checkout,
   and verify they match the recorded SHAs. Use those pinned objects for every diff and log:
   ```bash
   git merge-base <base-sha> <review-head-sha>  # record as <merge-base-sha>
   git diff <merge-base-sha> <review-head-sha>
   git diff --stat <merge-base-sha> <review-head-sha>
   git log <merge-base-sha>..<review-head-sha> --oneline
   ```
   Do not mix a live `gh pr diff` with local `HEAD`: either can differ from the pinned PR.
3. Compare `git rev-parse HEAD` and `git status --short` with the selected target. Source
   inspection and checks must use the same snapshot as the diff. A clean checkout at the
   pinned head can be used directly. Otherwise create a temporary detached worktree at
   `<review-head-sha>` and give every reviewer that path. Never inspect or run checks in a
   divergent checkout and attribute the results to the PR. If the pinned source cannot be
   obtained, report the review as incomplete; checks that cannot run there are "not run."
4. Include tracked uncommitted changes only when the original checkout's `HEAD` equals
   the pinned review head. Capture them with `git diff --binary HEAD` (staged and unstaged
   together), record the patch's SHA-256, and apply it in the temporary worktree with
   `git apply --index <patch-file>` so newly added files enter its diff too. For this
   snapshot, generate the diff and file map with `git diff <merge-base-sha>` and
   `git diff --stat <merge-base-sha>` **in that worktree**; inspect and check it there too.
   Mark the report and receipt `dirty=yes` and include the patch digest. If local `HEAD`
   differs, review the pinned target and state that local commits and uncommitted changes
   were excluded; do not transplant a patch based on another revision.
5. Do not switch the original checkout's branch, commit, push, open PRs, or file tickets.
   Leave its working tree and index exactly as found. Review tracked changes by default;
   mention untracked files only if they appear relevant.
6. Infer intent from the request, PR title/body, recent commits, plan docs, and the diff.
   Do not infer a new platform, trust, or concurrency guarantee from a hypothetical edge
   case. Do not block on questions unless scope is impossible to infer.

## Context card reviewers need

Build this card before dispatching anyone, from the repo rather than from this skill.
Give every reviewer the same card, verbatim — findings are wrong without it.

Read project instructions from the selected review snapshot (`CLAUDE.md`, `AGENTS.md`,
`CONTRIBUTING.md`, `.cursorrules`, and docs the change points at) and the CI or package
manifest. The card has six parts:

- **Surfaces and blast radius.** Name each user-facing surface and who is hurt when it
  breaks. The same crash is more severe on a public surface than on an operator-only one.
  Who is hurt moves severity. How often the path runs is a separate measurement.
- **Invariants always in force.** Guarantees the project documents: tenant scoping, auth
  boundaries, cache rules, "a save is visible on the next read." Quote the source. Do not
  invent one the docs do not state.
- **Severity escalations.** Flows the project treats as critical (checkout, payments,
  publishing, anything it says is revenue-bearing or irreversible). Escalating one of
  these is an S move. Write it as `S1 → S0 (card: <flow>)`.
- **Path-to-lens routing.** Start from the default table below. Add a row when the project
  docs name a path that needs its own lens.
- **Standards checklist.** Rules you can cite: type discipline, layering, migrations, i18n,
  test commands, PR conventions. If the instructions name none, the card says so.
- **Cheap checks.** The project's lint, typecheck, and unit-test commands. Run them during
  the review. Record the exact command and result. A check you did not run is "not run."

Carry the pinned base/head SHAs, merge-base SHA, review worktree path, and any included
patch digest into every reviewer prompt. `dirty` describes the reviewed snapshot, not
unrelated edits left in the original checkout. This skill does not ship another project's
surfaces, invariants, or ticket prefix.

## Review Team

Use a fresh read-only subagent per focus. Launch them in a single message so they run
concurrently. Give each: the diff, the intent, the changed-file list, the context card
above, the Finding Contract below, and one focus. They return findings only — no fixes, no
summaries. Reviewers lead each finding with its **P**, and back it with the S, the F, and
the invariant. P must be the matrix result for the S/F pair they named — a reviewer that
hands you a P with no S/F behind it has guessed, so re-derive it yourself before it reaches
the report.

First settle the fan-out size. **Full capacity** means one fresh subagent per warranted
focus, all in parallel — the default. **Constrained mode** (a handed worker budget, or a
diff so large that per-focus reviewers would each need the whole tree) combines compatible
lenses into fewer reviewers: assign each an explicit, disjoint lens group and require a
separate findings pass per lens in that group. Cover every mandatory lens; combine
warranted optional lenses the same way rather than dropping them. Each reviewer starts
fresh and is used once — never resume a finished reviewer for a second lens.

Always cover these focuses:

- **correctness** — logic bugs, edge cases, state, error handling, intent mismatch.
- **testing** — missing or weak tests for changed behaviour. Use the test layers the
  context card names. A missing test is a verification gap. It is a production failure
  only when the code shows one.
- **maintainability** — show the cost of an ordinary future change: which callers must
  coordinate, which representations must agree, or which check gets duplicated. File
  length is a search hint, not a defect. A redesign that does not name that cost is an
  optional proposal and does not gate the merge.
- **project-standards** — the checklist on the context card.

Add focused reviewers only when the diff warrants them. The context card may add rows.
Otherwise route by changed paths:

| Changed paths | Add reviewer |
| --- | --- |
| Tenant, account, or organization scoping on reads, writes, or cache keys | **multi-tenancy** — only when the card says the project isolates tenants. Cross-tenant leakage, cache-key isolation |
| Auth, session, permission checks, request handlers, user input, secrets | **security** — authn/authz, validation at the boundary, secret exposure, injection |
| Queries inside loops, caching, hot paths, work added to a request | **performance** — N+1, unbatched queries, cache misuse, repeated work |
| Exported types, request and response schemas, public routes, event payloads | **api-contract** — breaking shape changes, unversioned edits, coupled clients |
| Retries, timeouts, background jobs, upstream calls, partial failure | **reliability** — idempotency, failure when a dependency is down, observability |
| Migrations, schema changes, backfills | **data-migration** — destructive or blocking changes, missing backfill, compatibility with the deployed app |
| UI components, styles, client state | **frontend** — accessibility, responsiveness, state that races the user |
| Locale catalogs, translation calls, new user-facing strings | **i18n** — only when the project ships translations. Empty or hardcoded strings the project gates on |
| Large or high-risk change | **adversarial** — try to break the feature as each actor the card names |

If subagents are unavailable, run the same focuses yourself.

## Project-standards checklist

The checklist is the one on the context card. Cite the rule when you flag it — project
instructions, not preference. If the card's checklist is empty, say that this lens found
no project rules, and do not invent any.

**Verification you should actually run** (cheap, and it converts speculation into
confidence-100 findings): the cheap checks named on the card. Report a failing check as a
finding with the output; never claim a check passed that you did not run.

## Finding Contract

Each finding includes:

- `severity` (S) — how bad **one hit** is:
  - `S0` irreversible data loss or corruption, exploitable vulnerability, the public
    surface down, cross-tenant exposure when the project isolates tenants, or a critical
    flow the context card names.
  - `S1` user-facing bug, contract break, serious operational risk.
  - `S2` meaningful edge case, performance issue, maintainability trap, missing coverage.
  - `S3` low-risk polish.
- `frequency` (F) — how often realistic usage crosses the failure path. Derive it from the
  triggering conditions, not gut feel: name what must be true for the path to execute.
  - `F0` every-use — normal use of the feature hits it: every render of a surface that
    uses the changed component, every submission of the changed flow.
  - `F1` common — typical workflows hit it regularly: a widely used screen, a primary
    locale, most tenants' configuration.
  - `F2` occasional — specific but realistic conditions: one tenant's configuration, a
    rarely enabled feature flag, an error branch that does fire in production.
  - `F3` rare — unusual timing, narrow race, exotic state, hand-crafted URL, an upstream
    outage plus a specific in-flight request.
- `priority` (P) — computed from the risk matrix, never assigned by feel:

  |        | F0  | F1  | F2  | F3  |
  | ------ | --- | --- | --- | --- |
  | **S0** | P0  | P0  | P0  | P0  |
  | **S1** | P0  | P1  | P1  | P2  |
  | **S2** | P1  | P2  | P2  | P3  |
  | **S3** | P2  | P3  | P3  | P3  |

  The S0 row never discounts — a cross-tenant leak reachable only through a contrived URL
  is still P0. `S1/F0` promotes — a bug every visitor hits on every page load is
  drop-everything even though one hit is "just" a user-facing bug.

  S and F are independent measurements. **Never bend one to reach a nicer P.** "It's only
  a config edge case" is an F argument, not a reason to downgrade S. "This is a flow the
  card marks critical" is an S argument, not a reason to inflate F.

  **P leads; S/F lives in the detail.** Tables, section headers, the verdict, fix order and
  the receipt summary carry the bare `P` — that is what makes a report skimmable at a
  glance. Each finding's detail bullet then records the measurement behind it, written
  `S<n>/F<n> → P<n>`, because whoever acts on the finding needs to know whether a `P1` is a
  rare catastrophe or a constant paper cut. Lead with P — but never ship a finding whose
  S/F appears nowhere.

- `invariant` — one clause naming the guarantee the code breaks, and its basis: a user
  decision, public docs, a test, or an inference. An inference stays an open question.
  This is the clustering key — symptoms share an invariant, not necessarily a file. Say
  when the cause is older than the diff and this change only adds another instance.
- `merge_gate`: `blocks` (must fix before merge), `conditional` (merge only with explicit
  acceptance, mitigation, or follow-up), `non_blocking`.
- `blast_radius`: `end-users`, `critical-flow`, `tenant`, `single-tenant`, `operators`,
  `ops-only`, `developer-only`, or `unknown`. The card may name a tighter one.
- `file:line` — exact location.
- `title` — one short clause: the consequence in plain words. Its subject is not a bare
  identifier.
- `why` — observable impact, not just code style.
- `fix` — concrete recommendation.
- `confidence`:
  - `50` plausible but not fully provable.
  - `75` verified against surrounding code and likely to affect real usage.
  - `100` mechanically certain from code, tests, types, a failing check you ran, or an
    explicit repo rule.

### Calibrating S and F

- **Who is hurt moves S, not F.** Take the surfaces from the context card. The same crash
  is more severe on a public surface than on an operator-only one, because the blast
  radius differs. How often it fires is unchanged.
- **Apply the card's severity escalations** and write the move (`S1 → S0 (card: checkout)`),
  so a reader can see it rather than guess it. A critical flow is not automatically F0.
- **Cross-tenant reads or mutations are `S0`** when the card says the project isolates
  tenants, however contrived the trigger. Put the contrivance in F and leave S alone.
- **A shared surface raises F, not S.** A defect in a header, shell, or commonly composed
  component is `F0`/`F1` because every page that composes it hits the path. The same
  defect behind one tenant's flag is `F2`.
- **Missing test coverage** is usually `S2`, with F taken from the frequency of the
  untested path — a common path with no test is `S2/F0 → P1`, an exotic branch is
  `S2/F3 → P3`.

Suppress findings that are:

- Style issues a formatter or linter already owns. Never report formatting.
- Generic "consider" advice without a concrete failure mode.
- Pre-existing issues not made worse by the diff.
- Made impossible by _local_ structure — the type system, the immediate caller, an
  adjacent guard, a test that pins the behaviour. That is not a bug at all.
- Personal preference not backed by project instructions or user impact.
- Redesign proposals that do not show the cost of an ordinary future change. Those go
  under optional proposals and do not gate the merge.

### Latent hazards — serious in isolation, unreachable today

When the counterexample check shows the failure is real in the code but prevented only by a
_remote_ precondition — an entry-point gate, middleware, a wrapper every current caller
happens to use — neither file it as a live bug nor drop it. Reclassify it as a `latent
hazard` with:

- the exact guard that makes it unreachable (`file:line`),
- `S-if-unguarded` — the severity if that guard fell,
- the unguarding trigger — a new caller, a new route or entry point, a guard refactor,
- the cheapest local enforcement — a fail-fast assertion at the vulnerable site, or a test
  that pins the remote guard.

Latent hazards carry no priority and never gate the verdict: filing unreachable code as P0
is crying wolf. They are not noise either — the usual way a serious bug ships is a new
entry point that bypasses a rule only one path enforced. They get their own report
section, clustered by invariant like everything else.

## Synthesis

Before reporting:

1. Deduplicate overlapping findings.
2. **Cluster by invariant.** Findings that violate the same guarantee are one root-cause
   cluster, not N independent bugs. Present a cluster as one lead finding with every known
   symptom site listed, and make the recommended fix cause-level — restore the invariant —
   not a per-site patch. Then hunt the cluster's _missing_ symptoms: walk the other code
   paths that touch the same invariant and check whether they violate it too. That means
   the other callers, the other surface named on the card, the error branch, and the
   manual path next to an automatic one. A cluster reported
   with only the symptoms that happened to be found is how "fixed" bugs come back under a
   new repro.
3. Run a counterexample check: identify what nearby code path, guard, caller, middleware,
   wrapper, test, or config would make the finding false, then inspect it. A _local_
   counterexample kills the finding; a _remote_ guard turns it into a latent hazard.
4. Verify each surviving finding against the code yourself.
5. For every P0 and confidence-100 P1, include proof:
   - `red_test`: failing test to add before the fix, using the project's own test stack, or
   - `repro`: exact steps, a command, a query, or an observability check in the environment
     the project actually uses, or
   - `reason_unprovable`: why local proof is impossible.
     If no proof is available, lower confidence or say what evidence is missing. Label a
     test you did not run, and a repro you did not execute, as proposed. Do not describe
     either as a failure you observed.
6. Drop findings below confidence `75`, except important P0/P1 risks that should be
   surfaced with uncertainty.
7. Separate pre-existing issues from diff-introduced issues.
8. Recalibrate severity, frequency, and merge gate after deduplication and clustering.
   Rank a cluster from one symptom's complete S/F pair. Do not pair one symptom's severity
   with another symptom's frequency. Apply the card's surface and escalation rules, then
   **recompute P from the matrix**. Sort by priority, then confidence, then file path.

## Report Format

Lead with findings. If there are none, say so plainly and mention residual test gaps or
risks.

Use this shape:

```markdown
## Review Results

**Scope:** <diff scope>
**Intent:** <what the change appears to do>
**Surface:** <surfaces from the context card>
**Reviewers:** correctness, testing, ...
**Checks:** <command> ✅ · <command> ✅ (or "not run")

### 🔴 P1 -- High

| #   | File              | Issue                      | Gate   | Blast Radius | Reviewer      | Confidence |
| --- | ----------------- | -------------------------- | ------ | ------------ | ------------- | ---------- |
| 1   | `path/file.ts:42` | Query not scoped to domain | blocks | tenant       | multi-tenancy | 100        |

- **#1** -- `S1/F1 → P1`. **Impact:** <observable impact>. **Invariant:** <guarantee broken; other symptom sites in the cluster, if any>. **Checked:** <counterexample inspected>. **Proof:** <red test/repro/reason unprovable>. **Fix:** <cause-level fix>.

### 🛡️ Latent Hazards -- guarded upstream, no priority

- **L1** -- `path/g.ts:88` -- <would-be failure>. **Guarded by:** `middleware.ts:31`.
  **S-if-unguarded:** S0. **Unguarded by:** <a new route/caller that skips the guard>.
  **Local enforcement:** <assertion or guard-pinning test>.

### 🧪 Testing Gaps

- <only meaningful gaps>

### ⚠️ Residual Risks

- <only meaningful risks>

---

> **Verdict:** ✅ Ready to merge | 🟡 Ready with fixes | ⛔ Not ready
> **Fix order:** 🔥 P0 -> 🔴 P1 -> 🟠 P2 where relevant
```

Rules:

- Group findings by `### 🔥 P0 -- Critical`, `### 🔴 P1 -- High`, `### 🟠 P2 -- Moderate`,
  `### 🔵 P3 -- Low`; omit empty sections. Sections group by the **computed** P.
- **P skims, S/F explains.** The P section header is the only priority marker the table
  needs — keep the table narrow. Every detail bullet opens with the triple
  (`S<n>/F<n> → P<n>`) before the labelled parts, so the measurement is one line away
  without cluttering the skim.
- A root-cause cluster is one numbered finding: lead site in the table, every other symptom
  site named in the **Invariant** bullet. S and F come from one symptom's complete pair.
- The Issue cell is one short clause: the consequence in plain words, about eight words,
  and its subject is not a bare identifier. Put the mechanism in the detail bullet.

  | Don't | Do |
  | --- | --- |
  | `normalizeIds` sorts before slicing | Past the cap, the wrong items survive |

- Keep the explanation in keyed bullets.
- Detail bullet order: the triple first, then bold labels — **Impact**, **Invariant**,
  **Checked**, **Proof**, **Fix** — when relevant.
- Reuse stable finding numbers everywhere; latent hazards use `L<n>`.
- Include exact file and line for every code finding.
- Do not apply fixes unless the user explicitly asks for fixes.
- If asked to fix a P0 or confidence-100 P1, write the red failing test first, then make it
  green. If the issue is not testable, use the listed repro instead. Re-run the cheap
  checks from the context card after fixing.
- Do not include time estimates.

## Publish the receipt

**Every PR must carry at least one documented review before it merges.** When the diff
under review belongs to an open PR, post a receipt after delivering the report. Skip this
only when there is no PR yet (reviewing a local branch) — then post it once the PR exists.

Receipts are **append-only**: post a new comment per run rather than editing an earlier
one, so successive reviews of a PR stay visible as an audit trail.

Keep the receipt **small**. It is a record that a review happened and what it concluded —
not a copy of the whole report. The terminal report is where the person acting on the
findings reads the detail.

```bash
gh pr comment <n> --body "$(cat <<'BODY'
## 🔍 Code Review

**Verdict:** 🟡 Ready with fixes
**Reviewed commit:** `<full-head-sha>`
**Uncommitted changes:** no
**Reviewers:** correctness, testing, maintainability, project-standards, multi-tenancy
**Findings:** 1 P1, 2 P2 — 1 blocking · 1 latent hazard
**Checks:** <commands actually run>

<details><summary>Findings</summary>

| #   | P   | File              | Issue                      | Gate   | Conf |
| --- | --- | ----------------- | -------------------------- | ------ | ---- |
| 1   | P1  | `path/file.ts:42` | Query not scoped to domain | blocks | 100  |

**#1** — `S1/F1 → P1`. **Impact:** one tenant can read another's records by changing the id.
**Invariant:** every read is scoped to the tenant resolved for this request. **Fix:** pass
the resolved tenant into the query and into its cache key.

**L1** — `lib/records.ts:88` — unscoped fallback, guarded by the request middleware.
**S-if-unguarded:** S0. **Local enforcement:** assert the tenant id at the query site.

</details>

<!-- infi-code-review sha=<full-head-sha> verdict=ready-with-fixes blocking=1 dirty=no -->
BODY
)"

gh pr edit <n> --add-label agent-reviewed
```

What goes in the collapsed block:

- The findings table, one row per finding — always. The receipt has no P section headers, so
  the table carries a bare `P` column; that column is the whole point of the receipt at a
  glance.
- Per-finding bullets — the `S<n>/F<n> → P<n>` triple, then **Impact** + **Invariant** +
  **Fix** — **only for findings whose gate is `blocks`**. Everything else is table-only; the
  reader has the file:line and the terminal report for detail. Exception: if `P` alone would
  mislead on a table-only row (an `S0` with a rare trigger, an `S2` that only reached P1 on
  frequency), append the triple in parentheses to its issue text.
- Latent hazards: one line each (`L<n>` — site, guard, `S-if-unguarded`, local
  enforcement). They are the part a future reviewer of a _different_ PR most needs, so keep
  them even when trimming.
- Testing gaps and residual risks: one line each, only if genuinely meaningful.
- Omit the **Checked** and **Proof** detail, the scope/intent preamble, and the fix-order
  footer — those belong to the delivered report, not the receipt.
- If a receipt would still run long, cut prose, never findings: a row per finding is the
  part that must survive.

Rules:

- `**Reviewed commit:**` and trailer `sha` use the pinned review head, never a branch name
  or a newly queried PR head that was not reviewed.
  When the review included uncommitted changes, set `**Uncommitted changes:** yes` and
  `dirty=yes` in the trailer, and add `**Included patch SHA-256:** <digest>` to the body.
  The verdict and checks cover that combined snapshot, not the committed PR alone.
- The trailing HTML comment is the machine-readable part. Keep the `sha`, `verdict`,
  `blocking`, and `dirty` keys and their spelling stable. `verdict` is one of `ready`,
  `ready-with-fixes`, `not-ready`.
- Do not write reports to files in the repo, a gist, or a side branch. The receipt is the
  record; GitHub stores it on the PR. The trailer keys make the comments searchable.
- Apply the **`agent-reviewed`** label on every receipt (idempotent — re-applying is a
  no-op). The label means "a documented review exists", not "approved": read the latest
  receipt for the verdict.
- The label does not expire when new commits land. Re-read the PR's base/head SHAs before
  posting. If either differs from the pinned pair, say the review covers an earlier range;
  keep the original reviewed SHA. Review the new range before posting a verdict for it.
- Do not post a receipt for a review you did not actually complete, and do not claim
  reviewers or checks that did not run.
- If `gh` fails (no PR, no auth), report the failure and hand the user the report — do not
  silently drop the receipt.

## Final Gate

Before delivering, re-check that every finding is actionable, diff-related, accurately
cited, plausible to fix in this codebase, and not duplicate/speculative/lint-only — and
that no reported check result was assumed rather than run.

Verify the reviewed source still matches the pinned head plus the recorded patch, if any.
If it changed during the review, repeat the affected inspection and checks against the
recorded snapshot before issuing its verdict. Every reported check names that snapshot.

Then re-check the priority arithmetic specifically, because it is the part that silently
degrades into vibes:

- Every finding has an explicit S and F behind it, each justified by something in the code —
  a named blast radius for S, a named triggering condition for F — and that triple is
  visible in its detail bullet, not just in your head.
- P equals what the matrix says for that S/F pair. If a P "feels wrong", fix the S or F
  measurement and recompute; never hand-edit P.
- No S was softened and no F was inflated to land on a comfortable P — especially not for
  an S0 the card marks critical, which the matrix deliberately refuses to discount.
- Every finding sits in the section its computed P names, and nothing unreachable is filed
  with a priority at all — that belongs in latent hazards.
- Read each Issue cell as someone who knows what the change is for and has never opened
  the file. Rewrite a cell whose subject is a bare identifier, or that only makes sense
  if you already know the implementation.
