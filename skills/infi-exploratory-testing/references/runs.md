# Runs log

One entry per exploratory run: what was covered, findings by severity, and
**process learnings** — where a walker, lens, or recipe fell short. Learnings must
be folded back into the skill or the project adapter. This log records that it
happened. It is not where the fix lives.

The most recent completed run is the comparison baseline. Phase 4 diffs new
findings against its report so recurring issues are tagged "previously known —
still present", not re-filed as new.

Project history does not belong in this file. Environment noise, untestable
surfaces, and recently fixed bugs live in the project adapter. A hit that
matches the adapter's noise list is environment, and the run says so under
coverage.

## Entry template

```markdown
## Run <n> — <YYYY-MM-DD> — <slug>

- Scope, surface, environment, commit. Dirty tree: yes/no.
- Scenarios walked / blocked. Lenses used.
- Findings: N P0, N P1, N P2, N P3.
- Report: `findings/ET<N>.md`. Evidence: `<run dir>`.
- Process learning folded back, and which file changed.
```
