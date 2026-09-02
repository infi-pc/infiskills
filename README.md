# infiskills

Project-agnostic agent skills for reviewing, testing, and hardening software.
Written for [Claude Code](https://claude.com/claude-code), usable by any agent
harness that loads Markdown skills.

Available skills:

| Skill | What it does |
| --- | --- |
| [`infi-code-review`](skills/infi-code-review) | Multi-reviewer defect hunt over a diff. Fans out focused read-only reviewers, verifies findings against counterexamples, ranks them `P0`–`P3` from a severity × frequency matrix, and leaves a durable `findings/CR<N>.md` record. |
| [`infi-exploratory-testing`](skills/infi-exploratory-testing) | Multi-agent exploratory testing against a live app. Parallel walkers drive real scenarios and capture screenshot + accessibility evidence; a blind reviewer panel judges that evidence through five lenses; findings land ranked in `findings/ET<N>.md`. |
| [`infi-fix-planning`](skills/infi-fix-planning) | The counterpart of `infi-code-review`: turns a `CR<N>.md` findings report into root-cause fix plans with alternatives and net-LOC estimates, gates them on a one-line human decision sheet, then implements, adversarially verifies, and records the round in a per-PR `findings/FIXES-PR<id>.md` ledger. Invoked repeatedly, alternating with reviews, until no P0/P1 remains. |
| [`infi-review-loop`](skills/infi-review-loop) | The outer loop. Alternates capacity-scheduled review rounds (code review, exploratory, static, quality, docs) with fix rounds until the agreed stopping bars are met — or a cap or oscillation guard stops it. |

## Why these exist

Single-agent review has two failure modes: it finds plausible-sounding issues
that aren't real, and it misses whole classes of issue because one context can
only hold one perspective at a time. These skills attack both:

- **Independence over volume.** Every reviewer gets a fresh context and exactly
  one lens. Duplication across lenses is signal; a resumed context is not blind.
- **Findings must survive a counterexample check.** Before anything is reported,
  the orchestrator hunts the guard, caller, or config that would make the finding
  false — and inspects it.
- **`S/F → P`, never a bare priority.** Severity (how bad one hit is) and
  frequency (how often real usage crosses the path) are measured independently,
  and priority is computed from a fixed matrix. A bare `P1` hides whether it's a
  rare catastrophe or a constant paper cut, and that difference decides the fix.
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

Then ask for them by name — `/infi-code-review`, `/infi-review-loop` — or just
describe the task ("review this PR", "harden this branch until it's clean") and
let the harness match the skill description.

## Configuring for a project

Nothing is hardcoded to one repo. Each skill calibrates itself on the way in,
reading the project rather than assuming it:

- **Default branch, project instructions, static gates.** Discovered from
  `git`, `CLAUDE.md`/`AGENTS.md`/`CONTRIBUTING.md`, and `package.json`,
  `Makefile`, `justfile`, `pyproject.toml`, `Cargo.toml`, `go.mod`, or the CI
  workflow. `infi-review-loop` writes the exact commands into its scope contract
  and asks you to confirm them before it runs anything.
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
infi-review-loop                      # the outer loop; owns scope + convergence
├── static           → project gates
├── infi-code-review → per-lens reviewers   (loop mode: read-only, artifact-only)
├── infi-exploratory-testing → walkers + reviewer panel
├── quality          → taste proposals, never auto-applied
└── docs             → text-vs-code drift
```

Both inner skills detect loop mode and behave differently in it: they stop
allocating durable records, write only to an assigned untracked round artifact,
and hand stable-ID ownership to the loop orchestrator. Run standalone, each owns
its own numbered record.

Start with `infi-code-review` on a PR. Reach for `infi-review-loop` when the
scope is settled and you want it merge-ready without babysitting each round.

## License

MIT — see [LICENSE](LICENSE).
