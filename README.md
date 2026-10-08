# infiskills

Project-agnostic agent skills for reviewing, testing, and hardening software.
Written for [Claude Code](https://claude.com/claude-code), usable by any agent
harness that loads Markdown skills.

Available skills:

| Skill | What it does |
| --- | --- |
| [`infi-code-review`](skills/infi-code-review) | Independent reviewers establish defects and concrete maintenance costs, check counterexamples, calibrate risk against supported workflows, and leave a durable `findings/CR<N>.md` report. |
| [`infi-exploratory-testing`](skills/infi-exploratory-testing) | Multi-agent exploratory testing against a live app. Parallel walkers drive real scenarios and capture screenshot + accessibility evidence; a blind reviewer panel judges that evidence through five lenses; findings land ranked in `findings/ET<N>.md`. |
| [`infi-fix-planning`](skills/infi-fix-planning) | Compares fixes by user impact, ownership, caller obligations, and added/removed complexity. Supports plan-only requests and one authorized implementation-and-verification round, standalone or inside the loop. |
| [`infi-review-loop`](skills/infi-review-loop) | Composes review and fix planning with relevant testing tracks. Owns scope, authorization, finding status, and stopping rules until release guarantees have current evidence and remaining risks have authorized dispositions. |

## Why these exist

Single-agent review has two failure modes: it finds plausible-sounding issues
that aren't real, and it misses whole classes of issue because one context can
only hold one perspective at a time. These skills attack both:

- **Independent judgment.** Reviewers get fresh contexts; compatible lenses can
  share one reviewer when capacity is constrained. Verifiers receive the
  guarantee and original evidence without the fixer's expected conclusion.
- **Findings must survive a counterexample check.** Before anything is reported,
  the orchestrator hunts the guard, caller, or config that would make the finding
  false — and inspects it.
- **Risk and remedy are separate decisions.** S/F → P records consequence and
  frequency within a named workflow. Unknown user prevalence stays unknown.
  Merge gates need a release-based reason; priority alone never mandates a fix
  or authorizes accepting a risk.
- **Maintenance cost is explicit.** Compare ownership, caller obligations,
  states, protocols, and conversions added or removed. Rough production/test
  LOC supports that explanation; it does not decide which design is better.
- **Root cause over symptom count.** Findings sharing a broken invariant are one
  cluster with one cause-level fix, not N tickets — and the cluster's *missing*
  symptoms get hunted before it's reported.
- **Serious-but-unreachable is its own category.** A real bug held back only by a
  remote guard is filed as a *latent hazard* with the guard's location and its
  severity-if-unguarded. It never gates a verdict, and it's re-checked every
  round — because the usual way a P0 appears is a new entry point bypassing a
  guarantee only one path enforced.
- **Durable records, not chat.** Every review leaves a numbered, tracked file, so
  the next agent inherits the finding history instead of rediscovering it.
- **Closure needs affirmative evidence.** Name the tested candidate, actual
  reproduction/check result, independently examined paths and neighbors, and
  implemented maintenance tradeoff. A silent review never closes a finding.

## Install

Skills are directories containing a `SKILL.md`. Symlink or copy the ones you
want.

**Globally, for all your projects:**

```bash
git clone https://github.com/infi-pc/infiskills.git ~/www/infiskills
mkdir -p ~/.claude/skills
for s in ~/www/infiskills/skills/infi-*; do
  ln -sfn "$s" ~/.claude/skills/"$(basename "$s")"
done
```

**Into one project** (so the team gets them, and so you can commit a
project-specific exploratory adapter next to them):

```bash
mkdir -p .claude/skills
cp -R ~/www/infiskills/skills/infi-code-review .claude/skills/
```

Copy whole skill directories, including references. `infi-fix-planning` uses
the shared contract bundled in its sibling `infi-code-review` directory, so
install both. `infi-exploratory-testing` also uses that shared contract.
`infi-review-loop` requires review and fix planning, plus exploratory testing
when selecting that track. The global symlink command above installs all four.

Then ask for them by name — `/infi-code-review`, `/infi-review-loop` — or just
describe the task ("review this PR", "harden this branch until it's clean") and
let the harness match the skill description.

## Configuring for a project

Nothing is hardcoded to one repo. Each skill calibrates itself on the way in,
reading the project rather than assuming it:

- **Default branch, project instructions, static gates.** Discovered from
  `git`, `CLAUDE.md`/`AGENTS.md`/`CONTRIBUTING.md`, and `package.json`,
  `Makefile`, `justfile`, `pyproject.toml`, `Cargo.toml`, `go.mod`, or the CI
  workflow. Explicit user/workspace bases and the PR's actual base take
  precedence over the repository default. The loop records exact verification
  commands and reuses existing authorization; unresolved tradeoffs are presented
  as concrete choices before dependent implementation.
- **Findings directory.** `findings/` at the repo root by default; a different
  location named in the project instructions wins.
- **Run artifacts.** Written to the project's gitignored scratch directory
  (`.context/` if it has one, otherwise `.review-loop/` / `.exploratory/`).

The one thing exploratory testing genuinely needs from you is an **adapter** —
how to boot this app, how to seed state, how to force error and offline states,
and how to read the persisted value back. `infi-exploratory-testing` ships:

- [`references/adapter-guide.md`](skills/infi-exploratory-testing/references/adapter-guide.md)
  — the eight-section checklist an adapter must answer.
- [`references/web-recipes.md`](skills/infi-exploratory-testing/references/web-recipes.md)
  — a working generic adapter for any HTTP app, with copy-pasteable Playwright
  recipes for empty, loading, error, offline, permission-denied, oversized, and
  paginated states.
- [`assets/walker-template.cjs`](skills/infi-exploratory-testing/assets/walker-template.cjs)
  — the driver walkers copy and evolve, including the capture guard that refuses
  evidence until DOM and accessibility state agree across two windows.

Write the adapter once, commit it to the project, and every later run inherits
it. Fold each run's corrections back into it — a run's real output is a better
adapter plus a findings file.

## Using them together

```
infi-review-loop                       # scope, authorization, status, stopping
├── infi-code-review                  # independent findings and closure evidence
├── infi-fix-planning
│   ├── phase: plan                   # proportional options and dispositions
│   └── phase: execute                # authorized fixes and fresh verification
├── static                            # project verification gates
├── infi-exploratory-testing           # selected live-app evidence
├── quality                           # optional maintenance proposals
└── docs                              # descriptions match supported behavior
```

In loop mode, inner skills return assigned untracked artifacts. Only authorized
fix execution changes product/test files; the loop alone updates finding status
and commits when authorized. Standalone review produces a CR/ET snapshot;
standalone fixing owns current status in a FIXES ledger. Definitions live once
in the [shared review contract](skills/infi-code-review/references/review-contract.md).

Start with `infi-code-review` on a PR, or ask `infi-fix-planning` to propose fixes
without implementing them. Use `infi-review-loop` for the connected workflow.
Later passes target changed fixes, interactions, and coverage gaps; a new full
audit is used when justified. Repeated findings trigger causal diagnosis, and
round limits end with unresolved work reported rather than automatic acceptance.

## License

MIT — see [LICENSE](LICENSE).
