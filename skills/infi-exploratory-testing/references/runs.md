# Runs log

One entry per exploratory run: what was covered, findings by priority, and
**process learnings** — where a walker, lens, or adapter recipe fell short.
Learnings must be folded back into the skill's own files (process) or the
project's adapter (app specifics); this log records that it happened, it is not
where the fix lives.

The most recent completed run below is the comparison baseline. Phase 4 diffs new
findings against its report so recurring issues are tagged "previously known —
still present", not re-filed as new.

This file ships empty. If you are installing this skill globally and want
per-project run history, copy the skill into the project (or keep a project-local
`runs.md` alongside the adapter) so one project's history does not become
another's baseline.

## Entry template

```markdown
## Run <n> — <YYYY-MM-DD> — <slug>

Run dir and report: `<run-dir>/report.md` · Durable: `findings/ET<N>.md`
Adapter: `<path>` · App under test: `<url / commit>`

**Scope:** <what this run set out to cover, and what was explicitly excluded>.
**Coverage:** <N> scenarios, <N> completed / <N> partial / <N> blocked;
<N> paired screenshot+accessibility captures; lenses run: <list>.

**Results:** <N> new findings (<N> P0, <N> P1, <N> P2, <N> P3).
Previously known, still present: <IDs>.

**Known-issues baseline for the next run:**
- **ET<N>-F1** — <one-line description> (<lenses>).
- ...

**Process learnings:**
- <what failed in the process, and the exact file changed in response>.
```

---

<!-- Append new runs above this line, newest last. -->
