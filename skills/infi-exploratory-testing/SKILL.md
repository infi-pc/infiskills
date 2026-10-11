---
name: infi-exploratory-testing
description: >-
  Run a repeatable multi-agent exploratory testing pass over a live app surface.
  Parallel walker subagents drive the real app scenario-by-scenario, capturing
  screenshots plus accessibility snapshots and narrated walkthrough docs; a panel
  of independent reviewer subagents then judges the evidence through distinct
  lenses (UX flow, functional bugs, visual consistency, accessibility and
  keyboard, product copy, and adapter-selected lenses such as i18n or tenancy);
  the orchestrator dedupes and ranks findings P0-P3 with fix-complexity estimates
  into a readable report. Use when asked to exploratory-test, dogfood, QA,
  bug-hunt, UX-review, or visually audit an app, to walk through the app taking
  screenshots, or to produce a prioritized findings report.
---

# Exploratory testing

You are the **orchestrator**. You run the live app through a set of scenarios
using parallel **walker** subagents, judge the evidence with a panel of
independent **reviewer** subagents, then merge everything into one ranked,
readable report. You do not walk or review yourself — you set up, delegate, and
synthesize.

This is discovery-oriented testing. Code review judges a _diff_; the project's
automated suite proves _known_ behaviour still works; this skill hunts for
_unknown_ problems across a surface. When you finish, graduate anything durable
into that suite so the surface stays covered.

## What this produces

A single run directory `<run-root>/<date>-<slug>/` (gitignored) containing:

- `run.md` — scope, exclusions, environment, and a scenario status ledger.
- `scenarios/NN-slug/` — per scenario: `brief.md` (you write), `scenario.md`
  (walker writes), `driver.cjs` (replayable), `shots/`, `ax/`.
- `reviews/<lens>.md` — one file per reviewer lens.
- `report.md` — the ranked findings.

And one durable, tracked findings file:

- `findings/ET<N>.md` — the same detailed, ranked findings in a stable archive
  that survives cleanup of the gitignored evidence. Use the findings directory
  named by the project instructions when they name one. `<run-root>` is
  `.context/exploratory/` when the project uses `.context/`, otherwise
  `.exploratory/`. Add it to `.gitignore`.

Plus, when the run was driven against a branch with an open PR, a receipt comment
and the `exploratory-tested` label on that PR (Phase 5).

## Adapter

The skill owns the process. The project adapter owns this app: how to boot it,
how to seed state, which surfaces exist, and which of them are untestable here.

Look, in order, for:

- a project adapter — `references/adapter.md` next to the project-local copy of
  this skill, or a path the project instructions name;
- the project's own testing guide plus its existing end-to-end helpers;
- `references/web-recipes.md` — a generic browser adapter for any app reachable
  over HTTP.

If none of those can boot the app and seed state, write the adapter before
walking, using `references/adapter-guide.md`, and save it into the project. A
run without an adapter degenerates into walkers rediscovering how to log in.

**You own the single app server; subagents only connect to it.** Never let a
subagent start, restart, or stop it. If boot resets shared state, say so in
`run.md` and treat the server as immutable for the run. The adapter names the
concurrency ceiling. When it does not, use at most 4 walkers. A dev server that
compiles on demand usually cannot take that many; the adapter should say so.

## Phase 0 — Setup

1. Read the adapter, or write one from `references/adapter-guide.md` first.
2. Boot the app yourself, in the background, using the adapter's command. Wait
   for its readiness check. Record the URL, port, and whether boot resets shared
   state. Discover the port from the server output. Do not assume 3000.
3. Verify the surface answers before spawning anything, using the adapter's
   readiness check.
4. Allocate the durable findings ID before walking. Scan the findings directory
   for `ET*.md`, take the highest numeric suffix, and use the next positive
   integer (start at `ET1` when none exist). Never overwrite or fill an older
   gap. Record `findings/ET<N>.md` in `run.md`; follow-ups to the same run update
   that same file instead of allocating another ID.
5. Create the run directory and `run.md`: scope, explicit exclusions, the
   adapter path, surfaces, viewports, locales, out-of-band surfaces, and a
   scenario table with a Status column (`pending` at first).
6. If a previous run exists, note its `report.md` and ET file — Phase 4 diffs
   against them. `references/runs.md` is the log. The project's own run history
   lives in the project, not in this skill.

## Phase 1 — Define scenarios

**You** write every scenario brief; walkers explore _within_ a brief, they do not
invent their own. Stable scenario identities are what make runs comparable and
findings dedupable across time.

Write one `scenarios/NN-slug/brief.md` per scenario containing:

- **Goal** — one sentence in user language ("restore an older version", "check
  out with a saved card").
- **Surface** — which surface from the adapter this scenario drives.
- **Seed recipe** — exact starting state, in the adapter's vocabulary.
- **Boundaries** — what is in and out of scope for this scenario.
- **Expected evidence** — the key states that must be captured.
- **Owned state** — exactly which records this walker may create or mutate.
  Shared settings are single-owner: at most one concurrent scenario mutates a
  given setting, and it restores the original value.

Sizing rule: **one scenario is one walker sitting** — roughly 8 to 20
screenshots. Split anything larger. If the user's request did not pin the scope,
confirm the scenario list with them before spawning walkers.

## Phase 2 — Walkers

Spawn one walker subagent per scenario. Concurrency is the adapter's ceiling,
and at most 4 when the adapter names none. Run extra scenarios in batches inside
that limit. Contention on a shared dev server turns compiles into timeouts and
manufactures "the page never loaded" findings.

**State isolation.** Give every scenario fresh seeded state. Never share a
mutable account, tenant, or fixture between walkers. When the adapter says the
database is shared:

- Prefix created records `et-<run-slug>-s<NN>-` and delete them at the end.
  Anything left behind goes in `scenario.md`.
- A walker touches only the records it created.
- A shared setting is single-owner for the batch. Record the original value and
  restore it.
- Scenarios that need conflicting global state use different tenants, or they
  run one after another.

Give each walker a prompt built from this skeleton:

> You are a walker for scenario NN of an exploratory testing run. Your job is to
> complete the scenario's goal in the real app and document the walk as evidence.
>
> Read `<adapter path>`, then `<skill>/references/scenario-doc.md`. Copy
> `<skill>/assets/walker-template.cjs` into your scenario dir as `driver.cjs`
> and evolve it; run it with `node` from the directory where the project's
> Playwright install resolves.
>
> [paste the full brief.md inline]
> Scenario dir: <abs path>. Run dir: <abs path>. App URL: <url>.
>
> If the scenario needs shared server state, create a fresh one with the
> adapter's seed command. Never reuse another scenario's state.
>
> You may explore to find locators, but the deliverable evidence must come from
> `driver.cjs` so it replays. Prefer role/name locators.
>
> [paste the Artifact contract and Failure protocol verbatim]
>
> Do not start, stop, or restart the app server. Do not modify app source.
> Write only inside your scenario dir.

**Artifact contract (paste verbatim):**

> Write the `scenario.md` skeleton before your first product action, and update
> it after every captured state. If you are interrupted, the partial document
> plus captured shots must already be a valid `blocked` record. A scenario is
> done when `scenario.md` is complete per `references/scenario-doc.md`, every
> file in `shots/` is referenced from at least one numbered step, and
> `driver.cjs` replays the walk from a clean start. Text and screenshots are
> complementary, not redundant: the text must say what the image cannot — that
> an action was a drag, a hover, a keypress; where focus was; what the
> accessibility tree reported; what the network did. A screenshot nobody
> references is noise; delete it or reference it.

**Failure protocol (paste verbatim):**

> Distinguish two kinds of wall. A **setup or driver obstacle** (the script
> mishandles a step, a selector breaks, seeding fails) is not the scenario
> failing. Do not spend the sitting tuning the driver. If you cannot reach the
> first product action, write a setup-blocker record naming the exact obstacle
> and stop. A **product wall** (the app blocks the goal) is a result: try one
> alternate route, then set status `blocked` and document the wall with the
> exact step, a screenshot, the accessibility snapshot, and console errors. A
> blocker is itself a candidate finding. Before filing a product defect, rule
> out the environment noise named in the adapter.

When a walker reports a setup blocker, fix the brief, the adapter, or the driver
guidance and re-spawn a fresh walker once. A scenario central to the run must
not end uncovered only because its first drivers were wrong; tell the user
instead of quietly recording a gap.

When a walker returns, check `scenario.md` exists, its shots are referenced, and
its cleanup ran. Update the Status column in `run.md`.

## Phase 3 — Reviewer panel

Only after **all** walkers have finished. Select the lenses in
`references/reviewer-lenses.md`. Five is the default ceiling; each added lens
grows the dedupe pass superlinearly. Add `content-i18n` when the adapter says
the product ships more than one language, and `tenancy` when it isolates tenants
and the run walked more than one. Spawn the selected lenses together when you
can. Otherwise run fresh batches. Do not resume a finished reviewer for a second
lens. `functional` stays on its own reviewer when lenses are combined.

Give each reviewer: its own lens section from `reviewer-lenses.md`, the run dir
path, the adapter path, and the instruction to read every
`scenarios/*/scenario.md` and view every referenced screenshot (the Read tool
renders PNGs). Tell it where to write (`reviews/<lens>.md`) and where re-drive
evidence goes (`reviews/shots/` and `reviews/re-drive/`). Re-drives use fresh
seeded state. Only one reviewer re-drives at a time when the adapter's server
cannot take concurrent browsers.

**Independence + evidence discipline (paste verbatim into each reviewer
prompt):**

> Reviewers work blind to each other. Do not read `reviews/` or the walkers'
> anomaly conclusions as verdicts — treat everything as raw evidence. Duplication
> across lenses is signal; deduplication is the orchestrator's job, not yours. A
> finding without evidence does not exist: cite at least one screenshot or aria
> snapshot by path plus user-level repro steps. If your finding claims broken
> behavior the walker did not reproduce, re-drive the app to confirm before
> writing it, and mark confidence: `confirmed-by-re-drive`,
> `observed-in-evidence`, or `suspected`. Environment noise named by the adapter
> is not a finding.

## Phase 4 — Synthesis

Read every `reviews/<lens>.md` and produce `report.md` per
`references/report-format.md`.

1. **Collect** all findings (each is `LENS-NN`).
2. **Dedupe by root cause** — two findings merge when they share the same broken
   state or control, not merely the same screen. A merged finding keeps every
   evidence ref and lists all contributing lenses.
3. **Cross-check the previous run** (the previous ET file, and `references/runs.md`
   when this skill's copy is the project's). Anything already known is tagged
   "previously known — still present" and excluded from the _new_ count. Never
   re-file a known issue as new.
4. **Rank with the matrix in `infi-code-review`.** Assign severity and frequency
   independently, then compute priority. There is one matrix, and it lives in
   that skill's Finding Contract. Apply the adapter's surface and critical-flow
   escalations before the matrix, as severity moves. Reviewer agreement and a
   re-drive raise confidence. They do not change the severity of the consequence.
5. **Estimate complexity S/M/L** — you may read code (read-only) to judge this;
   label it an estimate.
6. **Walker blockers** enter the same pipeline as findings.

Write the complete merged report twice:

1. `<run-dir>/report.md` — the evidence-local report with links into the run.
2. `findings/ET<N>.md` — the durable, tracked findings record.

The ET file is not a pointer or executive summary. It retains the verdict, scope,
counts, fix-first list, every detailed finding (the `S/F → P` triple, complexity,
user impact, repro, evidence path, and suggested direction), coverage gaps, and
the run path. A finding must stay legible after the gitignored shots are gone.
Adjust relative evidence links for its location. If the run is revisited in the
same thread, update the allocated ET file rather than creating another record.

Then report to the user: lead with the health verdict and counts, then "what I'd
fix first" in product terms, and link the durable ET file as the primary handoff.
No file paths or code paths in the prose summary. **Default output is
report-only** — offer to file tracker issues only if asked.

## Phase 5 — Publish the receipt

When the run was driven against a branch that has an open PR, record that the run
happened — same pattern as code review and demo recording: a receipt comment
carrying the tested commit, plus a label. Skip only when the run is not tied to
a PR. There the ET file is the whole record. If the PR opens later, post the
receipt then.

Receipts are **append-only**: post a new comment per run so successive runs stay
visible as an audit trail.

Keep the receipt **small**. It records that a run happened, against which commit,
what it concluded, and where the detail lives — not a copy of the report. The ET
file is where the person acting on the findings reads the detail.

```bash
gh pr comment <n> --body "$(cat <<'BODY'
## 🧭 Exploratory Testing

**Verdict:** 🟡 Issues found
**Tested commit:** `<full-head-sha>`
**Uncommitted changes:** no
**Surface:** <surface from the adapter> · <environment>
**Scenarios:** 5 walked, 1 blocked
**Lenses:** ux-flow, functional, visual, accessibility, content-i18n
**New findings:** 1 P1, 3 P2, 1 P3 — previously known, still present: 2
**Report:** [`findings/ET4.md`](findings/ET4.md)

<details><summary>Findings</summary>

| ID  | Sev | Surface | Title                                     | Cx  |
| --- | --- | ------- | ----------------------------------------- | --- |
| F1  | P1  | <surface> | Publishing a page silently drops the menu | M   |

**F1** — **Impact:** the operator publishes and the page is unreachable from
navigation. **Direction:** keep the menu assignment across publish.

</details>

<!-- infi-exploratory-testing sha=<full-head-sha> et=ET4 surface=<surface> verdict=issues-found p0=0 p1=1 dirty=no -->
BODY
)"

gh pr edit <n> --add-label exploratory-tested
```

What goes in the collapsed block:

- One row per **new** finding — always. Previously-known findings are the count
  in the header, not rows.
- **Impact** + **Direction** bullets only for P0 and P1. Everything else is
  table-only; the reader has the ET file.
- Coverage gaps and litter left behind: one line each, only if genuinely
  meaningful (an uncleaned `et-<run>-` artefact always is).
- If it still runs long, cut prose, never findings.

Rules:

- `**Tested commit:**` is the full SHA the app was actually driven at — never a
  branch name. A run that cannot be tied to a commit proves nothing about the
  current head. When the tree was dirty, set `**Uncommitted changes:** yes` and
  `dirty=yes`. Do not present the SHA as the whole snapshot.
- Keep the trailer keys (`sha`, `et`, `surface`, `verdict`, `p0`, `p1`, `dirty`)
  and their spelling stable — they make receipts searchable. `verdict` is one of
  `healthy`, `issues-found`, `broken`.
- Apply the **`exploratory-tested`** label on every receipt (idempotent —
  re-applying is a no-op). It means "a documented exploratory run exists", not
  "approved": read the newest receipt for the verdict.
- The label does not expire when new commits land. If the PR has moved on since
  the last receipt, say so and re-run rather than leaving a stale receipt as the
  newest one.
- The receipt links the tracked ET file; it does not replace it. Never paste the
  full report into the comment, and never drop the ET file because a receipt
  exists.
- Do not post a receipt for a run you did not actually complete, and never claim
  a scenario, lens, or verdict that the evidence does not support.
- If `gh` fails (no PR, no auth), report the failure and hand the user the ET
  file — do not silently drop the receipt.

## After each run

The skill is a living document. When a walker misidentified a state, a lens
missed an obvious issue, or a recipe was wrong, **fix the template, lens, or
recipe itself** — that is where the improvement lives. Then append a `runs.md`
entry recording the run and the learnings. `runs.md` records that you improved
the skill; it is not a substitute for improving it.

Graduate durable, repeatable behaviors into the project's automated end-to-end
suite, following that project's testing guide, so exploration keeps feeding the
regression suite. Do not commit run evidence.

## Hard rules

- One app server, owned by you. Subagents connect; they never manage it.
- Drive the accounts and tenants the adapter names. Never point a run at
  production, and never drive a real customer the adapter does not list.
- Walkers own only what they created and clean up after themselves. Shared
  settings are single-owner per batch.
- No sleeps. Await a locator, an app-provided ready signal, a network quiesce,
  or a state assertion.
- Prefer role/name locators, then text, then semantic HTML. If a locator is hard
  to write, that is itself an accessibility finding.
- Do not update visual baselines unless the project's own testing guide says
  this environment is allowed to.
- A disagreement between two browser engines the product supports is a product
  signal, not flake. Engines the adapter excludes stay excluded.
- Capture a screenshot and accessibility snapshot only after the DOM and the
  accessibility tree agree across consecutive checks. A focus finding needs the
  active element, the computed focus style, and a shot that did not suppress
  outlines.
- Judge persistence from the value the adapter reads back, not from rendered
  text or a "Saved" label.
- Environment, not product, and must be flagged rather than filed: anything on
  the adapter's noise list, plus out-of-band surfaces (native dialogs, real
  payment capture, email delivery, push, the production CDN).
- Every completed run leaves a numbered `findings/ET<N>.md`. The gitignored run
  directory alone is not a durable handoff.
- A run driven against a branch with an open PR also leaves a receipt comment and
  the `exploratory-tested` label on that PR.
