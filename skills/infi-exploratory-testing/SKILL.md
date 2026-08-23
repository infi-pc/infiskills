---
name: infi-exploratory-testing
description: Run a repeatable multi-agent exploratory testing pass over a live app surface. Parallel walker subagents drive the real app scenario-by-scenario, capturing screenshots plus accessibility snapshots and narrated walkthrough docs; a panel of independent reviewer subagents then judges the evidence through distinct lenses (UX flow, functional bugs, visual consistency, accessibility and keyboard, product copy); the orchestrator dedupes and ranks findings P0-P3 with fix-complexity estimates into a stakeholder-readable report. Use when asked to exploratory-test, dogfood, QA, bug-hunt, UX-review, or visually audit an app, to walk through the app taking screenshots, or to produce a prioritized findings report.
---

# Exploratory testing

You are the **orchestrator**. You run a live app through a set of scenarios using
capacity-scheduled **walker** subagents, judge the evidence with a panel of independent
**reviewer** subagents, then merge everything into one ranked, stakeholder-readable
report. You do not walk or review yourself — you set up, delegate, and synthesize.

This is discovery-oriented testing: it hunts for *unknown* problems across a
surface, as opposed to proving a *specific change* works. When you finish,
graduate anything durable into the project's automated end-to-end suite so the
surface stays covered.

The skill is project-agnostic. Everything specific to *this* app — how to boot
it, how to seed state, what the control surface is — lives in a **project
adapter** (see Phase 0). The skill owns the process; the adapter owns the app.

## What this produces

A single run directory `<run-root>/<date>-<slug>/` containing:

- `run.md` — scope, exclusions, and a scenario status ledger.
- `scenarios/NN-slug/` — per scenario: `brief.md` (you write), `scenario.md`
  (walker writes), `driver.cjs` (replayable), `shots/`, `ax/`.
- `reviews/<lens>.md` — one file per reviewer lens.
- `report.md` — the ranked findings, written for the requester.

`<run-root>` defaults to the project's gitignored scratch directory —
`.context/exploratory/` if the project uses `.context/`, otherwise
`.exploratory/` (add it to `.gitignore`). Confirm the location in Phase 0.

And one durable, tracked findings file:

- `findings/ET<N>.md` — the same detailed, ranked findings in a stable archive
  that survives cleanup of the gitignored evidence directory. Use the findings
  directory named by the project instructions if they name one.

**Review-loop mode:** the `infi-review-loop` orchestrator preallocates and
exclusively owns the tracked ET record. You receive the fixed scope contract,
immutable round input head, existing stable finding inventory, and an assigned
untracked ROUND artifact path, plus the number of worker slots available beneath
you. Treat that handed worker capacity as a hard concurrency limit for both
walkers and reviewers; if it is missing, stop with a setup gap instead of
assuming a default. Write all evidence and the complete report only inside the
run directory; do not allocate, create, or edit `findings/ET<N>.md` or any other
tracked file. Reference handed stable IDs for confirmed follow-ups and use
round-local candidate IDs for new findings. The loop orchestrator maps those
candidates and merges your artifact into the durable ET record after all
selected review tracks stop.

## Phase 0 — Setup and adapter

An exploratory run is only as good as its ability to put the app into specific
states. That ability is the adapter's job.

1. **Find or write the adapter.** Look, in order, for:
   - a project adapter file — `references/adapter.md` next to this skill's
     project-local copy, or a path the project instructions name;
   - the project's own testing guide (`TESTING.md`, `docs/testing.md`,
     `e2e/README.md`) plus its existing end-to-end helpers;
   - `references/web-recipes.md` in this skill — the generic browser adapter,
     which works for any app reachable over HTTP with a dev server.

   If none of those describes how to boot the app and seed state, **write the
   adapter before walking**, using `references/adapter-guide.md` as the
   checklist, and save it into the project so the next run inherits it. A run
   without an adapter degenerates into walkers rediscovering how to log in.

2. **Boot the app and own the server.** Start the app or dev server yourself, in
   the background, using the adapter's boot command. Wait for its readiness
   check to pass rather than sleeping.

   **You own the single app server; subagents only connect to it.** Never let a
   subagent start, restart, or stop it. If the adapter's boot resets shared
   state (a test database, seeded accounts, fixture storage), restarting
   mid-run destroys every seeded account still in use — say so in `run.md` and
   treat the server as immutable for the run's duration.

3. **Allocate the durable findings ID** (outside review-loop mode) before
   walking. Scan the findings directory for `ET*.md`, take the highest numeric
   suffix, and use the next positive integer (start at `ET1` when none exist).
   Never overwrite or fill an older gap. Record `findings/ET<N>.md` in `run.md`;
   follow-ups to the same run update that same file instead of allocating
   another ID. In review-loop mode, record the assigned untracked ROUND artifact
   and the orchestrator-owned ET path in `run.md`, but do not write the ET file.

4. **Create the run directory and `run.md`:** the scope, explicit exclusions
   (e.g. a surface or flow deliberately out of scope this run), the adapter in
   use, the out-of-band surfaces the adapter declares untestable, and a scenario
   table with a Status column (`pending` at first).

5. **If a previous run exists**, note its `report.md` path — Phase 4 diffs
   against it. `references/runs.md` is the log of past runs; check it first.

## Phase 1 — Define scenarios

**You** write every scenario brief; walkers explore *within* a brief, they do not
invent their own. Stable scenario identities are what make runs comparable and
findings dedupable across time.

Write one `scenarios/NN-slug/brief.md` per scenario containing:

- **Goal** — one sentence in user language ("restore an older version of a
  document", "check out with a saved card").
- **Seed recipe** — exact starting state, expressed in the adapter's vocabulary.
- **Boundaries** — what is in and out of scope for this scenario.
- **Expected evidence** — the key states that must be captured.

Cover the surface deliberately rather than by instinct: the happy path, the
empty state, the error and offline states, the permission-denied state, the
smallest and largest viewport the product supports, and each theme or locale the
product claims to support. Error and degraded states usually need forced
responses (request interception), not just happy-path walking — the adapter
should say how.

Sizing rule: **one scenario is one walker sitting** — roughly 8 to 20
screenshots. Split anything larger. If the user's request did not pin the scope,
confirm the scenario list with them before spawning walkers.

`references/runs.md` may already define the next planned run — if so, use it.

## Phase 2 — Walkers

Spawn one walker subagent per scenario. Concurrency is
`min(4, handed worker capacity)` in review-loop mode and at most 4 otherwise.
The four-walker ceiling is local CPU/RAM and screenshot stability, not the
shared server — each walker runs its own browser instance, and contention makes
the settle helper produce jittery pixels and false visual findings. Run extra
scenarios in fresh batches or a rolling window within that limit.

Give each walker a prompt built from this skeleton:

> You are a walker for scenario NN of an exploratory testing run. Your job is to
> complete the scenario's goal in the real app and document the walk as evidence.
>
> Read `<adapter path>`, then `<skill>/references/scenario-doc.md`. Copy
> `<skill>/assets/walker-template.cjs` into your scenario dir as `driver.cjs`
> and evolve it; run it with `node` from `<the directory where the project's
> Playwright install resolves>`.
>
> [paste the full brief.md inline]
> Scenario dir: <abs path>. Run dir: <abs path>. App URL: <url>.
>
> If the scenario needs shared server state (an account, a tenant, a fixture
> record), create a FRESH one with `<adapter's seed command>`. Never reuse
> another scenario's state.
>
> [paste the Artifact contract and Failure protocol below verbatim]
>
> Do not start, stop, or restart the app server. Do not modify app source.
> Write only inside your scenario dir.

**Artifact contract (paste verbatim):**

> Write the `scenario.md` skeleton (goal, seed state, planned steps) BEFORE your
> first product action, and update it after every captured state — if you are
> interrupted at any point, the partial document plus captured shots must
> already be a valid `blocked` record with a stated coverage gap. A scenario is
> done when `scenario.md` is complete per `references/scenario-doc.md`, every
> file in `shots/` is referenced from at least one numbered step, and
> `driver.cjs` replays the walk against a fresh session. Text and screenshots
> are complementary, not redundant: the text must say what the image cannot —
> that an action was a drag, a hover, a keypress; where focus was; what the
> accessibility tree reported. A screenshot nobody references is noise; delete
> it or reference it.

**Failure protocol (paste verbatim):**

> Distinguish two kinds of wall. A **setup/driver obstacle** (your script
> mishandles a step, a selector or timing assumption breaks, seeding fails) is
> not the scenario failing — do not spend your alternate route on it, and do
> not spend the sitting tuning the driver: if you cannot reach the first
> product action within your milestone, write a setup-blocker record naming
> the exact obstacle and stop. A **product wall** (the app blocks the goal) is
> a result: try one alternate route, then set status `blocked` and document
> the wall with full evidence discipline — the exact step, a screenshot of the
> stuck state, the accessibility snapshot, console errors. A blocker is itself
> a candidate finding.

When a walker reports a setup blocker, fix the brief, the adapter, or the driver
guidance and re-spawn a fresh walker once — driver bugs are the orchestrator's
to solve, not a reason to lose the scenario. A scenario central to the run's
purpose (the highest-risk behavior the scope names) must not end the run
uncovered just because its first two drivers were wrong; escalate it to the user
explicitly instead of quietly recording a gap.

When a walker returns, check its `scenario.md` exists and its shots are
referenced. Update the Status column in `run.md`.

## Phase 3 — Reviewer panel

Only after **all** walkers have finished. Select the lenses defined in
`references/reviewer-lenses.md`; five lenses is the ceiling because each added
lens grows the dedupe pass superlinearly. Give every lens a fresh reviewer
context. When worker capacity holds all selected lenses, spawn them together.
Otherwise run fresh capacity-sized batches. If the parent milestone cannot
afford that many batches, combine only compatible lenses in fresh contexts
(`ux-flow` + `product-copy`, `visual` + `accessibility`), keep `functional`
independent, and require separate lens sections in the resulting artifact.
Never reuse a completed walker or reviewer context to simulate a blind lens.

Give each reviewer: its own lens section from `reviewer-lenses.md`, the run dir
path, the adapter path, and the instruction to read every
`scenarios/*/scenario.md` and view every referenced screenshot (the Read tool
renders PNGs). Tell it where to write (`reviews/<lens>.md`) and where re-drive
evidence goes (`reviews/shots/` and `reviews/re-drive/`); re-drives also use
fresh seeded state.

**Independence + evidence discipline (paste verbatim into each reviewer prompt):**

> Reviewers work blind to each other. Do not read `reviews/` or the walkers'
> anomaly conclusions as verdicts — treat everything as raw evidence. Duplication
> across lenses is signal; deduplication is the orchestrator's job, not yours. A
> finding without evidence does not exist: cite at least one screenshot or
> accessibility snapshot by path plus user-level repro steps. If your finding
> claims broken behavior the walker did not reproduce, re-drive the app to
> confirm before writing it, and mark confidence: `confirmed-by-re-drive`,
> `observed-in-evidence`, or `suspected`.

## Phase 4 — Synthesis

Read every `reviews/<lens>.md` and produce `report.md` per
`references/report-format.md`.

1. **Collect** all findings (each is `LENS-NN`).
2. **Dedupe by root cause** — two findings merge when they share the same broken
   state or control, not merely the same screen. A merged finding keeps every
   evidence ref and lists all contributing lenses.
3. **Cross-check the previous run** (`report.md` linked from `references/runs.md`).
   Anything already known is tagged "previously known — still present" and
   excluded from the *new* count. Never re-file a known issue as new.
4. **Rank with the shared risk matrix** (defined in the `infi-code-review`
   skill): assign severity `S0–S3` and frequency `F0–F3` independently, compute
   priority `P0–P3` from the matrix, and keep the full `S<n>/F<n> → P<n>` triple
   on every finding in every artifact — never a bare P. When lenses disagree,
   multi-lens agreement and `confirmed-by-re-drive` pull severity up;
   `suspected` pulls it down. Frequency comes from how often a real user's
   session crosses the path, and walker evidence is the best frequency source we
   have — say what had to happen in the walk to trigger it.
5. **Estimate complexity S/M/L** — you may read code (read-only) to judge this;
   label it an estimate.
6. **Walker blockers** enter the same pipeline as findings.

Outside review-loop mode, write the complete merged report twice:

1. `<run-dir>/report.md` — the evidence-local report with links into the run.
2. `findings/ET<N>.md` — the durable, tracked findings record.

In review-loop mode, write the complete merged report to the assigned
untracked ROUND artifact (and retain the evidence-local report when it is a
different path). Do not write the tracked ET record or human summary; return
the verdict, counts, stable follow-up IDs, round-local candidate IDs, and
artifact path to the loop orchestrator.

Outside review-loop mode, the ET file is not a pointer or executive summary.
It retains the verdict, scope, counts, fix-first list, every detailed finding
(the `S/F → P` triple, complexity, user impact, repro, evidence path, and
suggested direction), coverage gaps, and the run path. Adjust relative
evidence links for its location. If the run is revisited in the same thread,
update the allocated ET file rather than creating another record.

Outside review-loop mode, report to the requester in the style their project
instructions ask for: lead with the health verdict and counts, then "what I'd
fix first" in product terms, and link the durable ET file as the primary
handoff. No code paths in the prose summary. **Default output is report-only** —
offer to file tracker issues only if asked.

## After each run

The skill is a living document. Outside review-loop mode, when a walker
misidentified a state, a lens missed an obvious issue, or an adapter recipe was
wrong, **fix the template, lens, or recipe itself** — that is where the
improvement lives. Adapter fixes go into the project's adapter file; process
fixes go into this skill. Then append a `runs.md` entry recording the run and
the learnings. `runs.md` records that you improved the skill; it is not a
substitute for improving it. In review-loop mode, record proposed
skill/adapter changes in the untracked artifact for later triage; do not make
tracked edits during the selected review tracks' review step.

Outside review-loop mode, graduate durable, repeatable behaviors into the
project's automated end-to-end suite so exploration keeps feeding the regression
suite. In review-loop mode, return regression-test candidates to the loop
orchestrator for the fix plan.

## Hard rules

- One app server, owned by you. Subagents connect; they never manage it.
- Fresh seeded shared state per scenario and per reviewer re-drive. Never share
  a mutable account, tenant, or fixture record between walkers.
- No sleeps. Await a locator, an app-provided idle/ready signal, a network
  quiesce, or a state assertion.
- Prefer role/name locators. Assert application state as well as pixels.
- Durability and exact-content claims assert the **persisted representation**
  through the adapter's inspection API — file bytes, a database row, an API
  read-back — never rendered `innerText`; layout inserts newlines that fail
  valid states.
- A visible "Saved" label is not persistence evidence. Poll the persisted
  representation for the exact expected value, then re-read it from scratch for
  any scenario whose goal includes durability.
- Capture a screenshot/accessibility pair only after the DOM and accessibility
  state stay semantically stable across consecutive checks; a mismatched pair
  (shot from the outgoing state, snapshot from the next) is worse than no
  evidence.
- A focus finding needs the three-part proof: active-element identity, computed
  focus styling, and an unsuppressed screenshot — any one alone misleads.
- Drive explicit user retry and automatic reconnect as separate, deterministic
  steps; racing them makes the evidence unreadable.
- A cross-browser-engine disagreement is a product signal, not flake.
- Out-of-band surfaces the adapter declares untestable (OS keychains, native
  file dialogs, real filesystem event semantics, tray/menu delivery, updaters,
  code signing, push delivery, payment provider UIs, exact native webview
  rendering) are out of scope here and must be flagged, not tested. They belong
  to a packaged or manual smoke pass.
- Keyboard/focus scenarios must NOT apply screenshot-stability styles that
  suppress outlines — they hide focus rings and manufacture false accessibility
  findings. Use the walker template's `keepFocusStyles` path.
- Every standalone completed run leaves a numbered `findings/ET<N>.md`; the
  gitignored run directory alone is not a durable handoff. In review-loop mode,
  the loop orchestrator provides that durable handoff in its separate records
  step.
