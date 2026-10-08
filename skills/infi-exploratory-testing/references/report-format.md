# Report format: ranking rubric + report.md template

## Ranking: severity × frequency → priority

Read the [shared review contract](../../infi-code-review/references/review-contract.md)
for the single severity/frequency matrix, evidence fields, merge gates, and
closure rules. Keep `S<n>/F<n> → P<n>` on each finding and handoff so exploratory
and code findings can be triaged together.

Walker evidence establishes the trigger and observed consequence. It does not
establish how many users encounter that workflow. Name the affected population,
recovery, and any assumptions; leave unknown prevalence unknown. Reviewer
agreement or a successful re-drive increases confidence in the claim without
changing the severity of its consequence.

## Complexity (S/M/L, estimates)

Assigned by the orchestrator after read-only code inspection. Always labeled an
estimate.

- **S** — one screen or component, no design decision needed. Hours.
- **M** — crosses a flow or shared state, or needs a small design/copy decision.
  A day or two.
- **L** — touches architecture, or needs a product decision first. Multi-day.

## report.md template

```markdown
# Exploratory testing report: <run slug>

<one-line health verdict>.
New this run: N x P0, N x P1, N x P2, N x P3. Previously known, still present: N.

## What I'd fix first
1. <finding> — <one sentence of user impact>.
2. ...
(top 5, highest priority/impact first)

## Findings
| ID | Title | S/F → P | Complexity | Lenses | New / Known |
|----|-------|---------|------------|--------|-------------|
| F1 | ... | S1/F1 → P1 | M | functional, ux-flow | new |

### F1: <title>
- **What the user experiences:** <plain language, recovery, affected workflow
  and reach evidence; distinguish assumptions>.
- **Guarantee:** <invariant and its basis in a supported workflow>.
- **Repro (user steps):** 1. ... 2. ... 3. ...
- **Evidence:** <links to shots / ax / scenario.md>.
- **Confidence:** <confirmed-by-re-drive / observed-in-evidence / suspected;
  remaining uncertainty>.
- **Merge gate:** <blocks / conditional / non_blocking; release-based reason>.
- **Suggested direction:** <product-level, not a diff>.
- **Complexity:** S/M/L (estimate) — <one-line why>.

## Coverage
- Adapter: <path> · App under test: <url / build>.
- Walked: <scenarios and what each exercised>.
- Not walked / gaps: <what was intended but missed, and why>.
- Out of band, not testable in this harness: <the adapter's list>.

## Appendix
- Scenarios: <links to scenarios/*/scenario.md>
- Reviews: <links to reviews/*.md>
```

The prose the orchestrator sends the requester follows the project's instruction
files: lead with the verdict and the "fix first" list in product terms; keep file
paths out of the message body (they live in `report.md`); if a decision is needed,
structure it as question / options / recommendation.

## Durable findings archive

This section applies to standalone runs. In loop mode, write only the assigned
untracked artifact; the loop orchestrator owns durable records and status.

After writing the run-local `report.md`, write the same complete report to the
allocated `findings/ET<N>.md`.

- Allocate `N` in Phase 0 as one greater than the highest existing numeric
  `ET*.md` suffix; start at 1 and never reuse gaps.
- Keep the verdict, scope, counts, fix-first list, every detailed finding,
  coverage gaps, and the originating run path.
- Prefix finding IDs with the archive ID when useful (`ET3-F1`, `ET3-F2`, ...)
  so they remain unambiguous outside the run directory.
- Rewrite relative evidence links so they resolve from the findings directory.
- A follow-up appends revision-specific evidence to its existing ET file while
  preserving earlier observations. Link an existing FIXES ledger for current
  status instead of maintaining a second mutable status table.
- A clean run still gets an ET file with zero counts, walked coverage, and gaps.
