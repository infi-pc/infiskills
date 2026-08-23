# Report format: ranking rubric + report.md template

## Ranking: severity × frequency → priority

Use the same matrix as the `infi-code-review` skill, so exploratory and code
findings are directly comparable and can be triaged in one list.

**Severity (S)** — how bad one hit is. Calibrate the top of the scale to what
*this* product is trusted for: whatever the user would call unacceptable loss.

- **S0** — user data lost, corrupted, or silently overwritten; the core
  create/save/open path unusable; credentials or another user's data exposed;
  money moved wrongly.
- **S1** — a core flow fails, or *lies* such that the user cannot trust the
  result without a workaround; the app makes a wrong claim about saved or synced
  state; an accessibility issue blocks a core flow.
- **S2** — real friction: contradictory messages, confusing states, missing
  recovery actions, accessibility failures off the core path, visual defects on a
  primary screen.
- **S3** — polish: minor visual inconsistency, wording, cosmetics in rare states.

**Frequency (F)** — how often a real user's session crosses the failure path.
Walker evidence is the best frequency source available: say what had to happen in
the walk to trigger it.

- **F0** every-use · **F1** common · **F2** occasional (specific but realistic
  conditions) · **F3** rare (unusual timing, narrow race, exotic state).

**Priority (P)** — computed, never assigned by feel:

|        | F0 | F1 | F2 | F3 |
| ------ | -- | -- | -- | -- |
| **S0** | P0 | P0 | P0 | P0 |
| **S1** | P0 | P1 | P1 | P2 |
| **S2** | P1 | P2 | P2 | P3 |
| **S3** | P2 | P3 | P3 | P3 |

Keep the full `S<n>/F<n> → P<n>` triple on every finding in every artifact. A
bare `P1` hides whether it is a rare catastrophe or a constant paper cut, and
that difference decides the fix. The scale is capped at P3 on purpose — do not
invent P4+; open-ended scales drift between runs and break cross-run comparison.

When lenses disagree, multi-lens agreement and `confirmed-by-re-drive` pull
severity up; `suspected` pulls it down.

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
- **What the user experiences:** <plain language, no code>.
- **Repro (user steps):** 1. ... 2. ... 3. ...
- **Evidence:** <links to shots / ax / scenario.md>.
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

After writing the run-local `report.md`, write the same complete report to the
allocated `findings/ET<N>.md`.

- Allocate `N` in Phase 0 as one greater than the highest existing numeric
  `ET*.md` suffix; start at 1 and never reuse gaps.
- Keep the verdict, scope, counts, fix-first list, every detailed finding,
  coverage gaps, and the originating run path.
- Prefix finding IDs with the archive ID when useful (`ET3-F1`, `ET3-F2`, ...)
  so they remain unambiguous outside the run directory.
- Rewrite relative evidence links so they resolve from the findings directory.
- A follow-up to the same exploratory run updates its existing ET file.
- A clean run still gets an ET file with zero counts, walked coverage, and gaps.
