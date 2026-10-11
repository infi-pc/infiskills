# infiskills

Project-agnostic agent skills for reviewing a pull request, exploring a live app,
and recording a narrated demo. Written for [Claude Code](https://claude.com/claude-code),
usable by any agent harness that loads Markdown skills.

Available skills:

| Skill | What it does |
| --- | --- |
| [`infi-code-review`](skills/infi-code-review) | Reviews the open pull request on the current branch. Independent reviewers check the diff, the orchestrator verifies findings, and the skill posts an append-only receipt comment on the PR. |
| [`infi-exploratory-testing`](skills/infi-exploratory-testing) | Multi-agent exploratory testing against a live app. Walkers capture screenshot and accessibility evidence; a blind reviewer panel judges it; findings land in `findings/ET<N>.md` and, when a PR is open, in a receipt comment. |
| [`infi-demo-recording`](skills/infi-demo-recording) | Records narrated feature walkthroughs with a visible cursor, captions, and voiceover timed to the picture. Posts a receipt on the open PR. |

## Why these exist

Single-agent review has two failure modes: it finds plausible-sounding issues
that are not real, and it misses whole classes of issue because one context can
only hold one perspective at a time.

- **Independent judgment.** Reviewers and walkers get fresh contexts. The
  orchestrator verifies before anything is reported.
- **Findings must survive a counterexample check.** The orchestrator hunts the
  guard, caller, or config that would make the finding false, and inspects it.
- **Priority is computed.** Severity times frequency produces P0–P3. The matrix
  lives in `infi-code-review`. Exploratory testing uses that same matrix.
  Who is hurt, and which flows the project treats as critical, are facts the
  project supplies. They move severity before the matrix runs.
- **Root cause over symptom count.** Findings that break the same guarantee are
  one cluster. A serious failure that current code cannot reach is a latent
  hazard. It does not get a priority and it does not gate the merge.
- **The pull request carries the record.** Each run posts a new comment with the
  commit SHA, the verdict, and a stable HTML trailer. Exploratory testing also
  writes `findings/ET<N>.md`, because a comment cannot hold the screenshots.

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

**Into one project:**

```bash
mkdir -p .claude/skills
cp -R ~/www/infiskills/skills/infi-code-review .claude/skills/
cp -R ~/www/infiskills/skills/infi-exploratory-testing .claude/skills/
cp -R ~/www/infiskills/skills/infi-demo-recording .claude/skills/
```

Copy whole skill directories, including references and assets. Exploratory
testing reads the risk matrix from the code-review skill, so install that skill
beside it.

Then ask for them by name — `/infi-code-review`, `/infi-exploratory-testing`,
`/infi-demo-recording` — or describe the task ("review this PR", "walk through
the app", "record a demo").

## Configuring for a project

Nothing is hardcoded to one repository. Each skill reads the project on the way
in:

- **The review target** is the open pull request on the current branch. An
  explicit PR, branch, or base still wins. With no PR, review against the
  repository's default branch.
- **The context card** for review comes from `CLAUDE.md`, `AGENTS.md`,
  `CONTRIBUTING.md`, and CI: surfaces, invariants, severity escalations, and the
  cheap check commands. Run those checks. Do not claim a result you did not run.
- **Findings from exploratory testing** go to `findings/` unless the project
  names another directory. Run evidence goes to `.context/exploratory/` when the
  project uses `.context/`, otherwise `.exploratory/`.

Exploratory testing needs an **adapter**: how to boot this app, how to seed
state, how to force error and offline states, and how to read a saved value
back. The skill ships:

- [`references/adapter-guide.md`](skills/infi-exploratory-testing/references/adapter-guide.md)
  — the checklist an adapter must answer.
- [`references/web-recipes.md`](skills/infi-exploratory-testing/references/web-recipes.md)
  — a generic browser adapter for any HTTP app.
- [`assets/walker-template.cjs`](skills/infi-exploratory-testing/assets/walker-template.cjs)
  — the driver walkers copy, including the capture guard that waits until the
  DOM and the accessibility tree agree.

Write the adapter once, commit it to the project, and the next run inherits it.

`infi-demo-recording` bundles a Playwright recorder, cached narration, a demo
config, a standalone example, and a video postprocessor. Its
[recording-kit guide](skills/infi-demo-recording/references/recording-kit.md)
explains how to copy those into a project that does not already have a
recorder. If the project has one, use that and do not overwrite it.

## License

MIT — see [LICENSE](LICENSE).
