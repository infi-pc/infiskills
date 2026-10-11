# Report format: ranking rubric + report.md template

## Ranking: severity × frequency → priority

Use the matrix in [`infi-code-review`](../../infi-code-review/SKILL.md), under
Finding Contract. Do not keep a second grid here. Assign `S0–S3` and `F0–F3`
independently, compute `P0–P3`, and keep `S<n>/F<n> → P<n>` on every finding.

Walker evidence establishes the trigger and the observed consequence. It does
not establish how many users encounter that workflow. Leave unknown prevalence
unknown.

Before the matrix:

- **Who is hurt moves severity.** Take surfaces from the adapter. The same
  failure is more severe on a public surface than on an operator-only one.
- **A critical flow named by the adapter moves severity one step.** Write the
  move (`S1 → S0 (adapter: checkout)`). It does not change frequency.

Reviewer agreement or a successful re-drive increases confidence. It does not
change the severity of the consequence. The scale stops at P3. Do not invent
P4+.

## Complexity (S/M/L, estimates)

Assigned by the orchestrator after read-only code inspection. Always labeled an
estimate.

- **S** — one screen or component, no design decision needed. Hours.
- **M** — crosses a flow or shared state, or needs a small design or copy
  decision. A day or two.
- **L** — touches a boundary the adapter calls load-bearing (tenancy, caching,
  publish, a migration), or needs a product decision first. Multi-day.

## report.md template

```markdown
# Exploratory testing report: <run slug>

<one-line health verdict>.
Scope: <surface(s)>, <environment>. Excluded: <...>.
New this run: N x P0, N x P1, N x P2, N x P3. Previously known, still present: N.

## What I'd fix first

1. <finding> — <one sentence of user impact>.
2. ...
   (top 5, highest severity/impact first)

## Findings

| ID  | Title | Surface | S/F → P    | Complexity | Lenses              | New / Known |
| --- | ----- | ------- | ---------- | ---------- | ------------------- | ----------- |
| F1  | ...   | <surface> | S1/F1 → P1 | M          | functional, ux-flow | new         |

### F1: <title>

- **What the user experiences:** <plain language, recovery, who is affected>.
- **Repro (user steps):** 1. ... 2. ... 3. ...
- **Evidence:** <links to shots / ax / scenario.md>. The words must still make
  sense if the gitignored shots are gone.
- **Confidence:** confirmed-by-re-drive | observed-in-evidence | suspected.
- **Suggested direction:** <product-level, not a diff>.
- **Complexity:** S/M/L (estimate) — <one-line why>.

## Coverage

- Walked: <scenarios and what each exercised>.
- Not walked / gaps: <what was intended but missed, and why>.
- Not testable in this environment: the adapter's out-of-band list.
- Litter left behind: <any state the walkers could not clean up>.

## Suggested regression coverage

Which findings or walked behaviours should graduate into the project's automated
end-to-end suite, and why.

## Appendix

- Scenarios: <links to scenarios/\*/scenario.md>
- Reviews: <links to reviews/\*.md>
```

The prose the orchestrator sends the user leads with the verdict and the "fix
first" list in product terms; file paths live in `report.md`, not in the message.
If a decision is needed, structure it as question / options / recommendation.

## Durable findings archive

After writing the run-local `report.md`, write the same complete report to the
allocated `findings/ET<N>.md`, or to the findings directory the project names.

- Allocate `N` in Phase 0 as one greater than the highest existing numeric
  `ET*.md` suffix; start at 1 and never reuse gaps.
- Keep the verdict, scope, counts, fix-first list, every detailed finding,
  coverage gaps, suggested regression coverage, and the originating run path.
- Prefix finding IDs with the archive ID when useful (`ET3-F1`, `ET3-F2`, …) so
  they remain unambiguous outside the run directory.
- Rewrite relative evidence links so they resolve from the findings directory.
  The run directory is gitignored, so a reader who does not have it sees the
  description, not the pixels. Findings must be legible without the shots.
- A follow-up to the same exploratory run updates its existing ET file.
- A clean run still gets an ET file with zero counts, walked coverage, and gaps.
- Filing tracker issues is a separate, opt-in step. When you do, put the ET id
  in the issue so the two records point at each other.
