# Reviewer lenses

Each reviewer takes **one** lens and judges the walkers' evidence through it. You
did not run the scenarios; you interrogate what they captured.

## Common rules (apply to every lens)

**Independence.** You work blind to the other reviewers. Do not read other files
in `reviews/`, and do not treat a walker's "Anomalies" as a verdict — treat
everything as raw evidence. Duplication across lenses is signal, not waste;
deduplication is the orchestrator's job. Never soften or drop a finding because
"someone else probably has it."

**Evidence discipline.** A finding without evidence does not exist. Every finding
cites at least one screenshot or accessibility snapshot by path, plus user-level
repro steps. If you claim broken behavior the walker did not itself reproduce,
re-drive the app to confirm before writing it (fresh seeded state; scripts in
`reviews/re-drive/`, shots in `reviews/shots/<lens>-NN-slug.png`). Mark every
finding's confidence: `confirmed-by-re-drive`, `observed-in-evidence`, or
`suspected`.

**Adapter awareness.** Read the project adapter's *Inspecting truth* and
*Out-of-band surfaces* sections before filing. Tooling artifacts already recorded
there are not product defects, and surfaces declared untestable are coverage
gaps, not bugs.

**Finding format.** Write findings to `reviews/<lens>.md`, each as:

```markdown
### <LENS>-NN: <short title>
- Proposed severity/frequency: S<n>/F<n> (see report-format.md)
- Confidence: confirmed-by-re-drive | observed-in-evidence | suspected
- Evidence: <paths to shots / ax / scenario.md sections>
- Repro (user steps): 1. ... 2. ... 3. ...
- Expected vs actual: <what a user would expect> / <what happens>
```

Propose severity and frequency independently and let the orchestrator compute
priority from the matrix. Never propose a bare P.

End your file with a short **"Noticed outside my lens"** section — one line each,
no expansion. Report it; don't chase it.

---

## Lens `ux-flow`

Can a real person complete each scenario's goal without confusion or a detour?

Check for: dead ends; missing feedback after an action (did anything confirm it
worked?); surprise modality (a dialog that traps you); unclear next step; moments
that *require* a workaround; navigation patterns that differ between screens;
misleading progress or status; destructive actions without confirmation or undo.
State what the user was trying to do and exactly where the flow broke.

## Lens `functional`

Does the app tell the truth and do what it claims? **This lens has the strongest
re-drive duty** — any functional claim the walker did not reproduce must be
re-driven before you file it.

Check for: contradictory simultaneous states (the canonical example: a list
showing both "Internal Server Error" and "Nothing here yet"); UI that stays stale
after the underlying state changed; wrong data shown; affordances that do nothing;
error states with no recovery path; optimistic UI that never reconciles with the
server's answer; a success message for a write that did not persist; console
exceptions; and any request reaching the backend while the app is offline.

Persistence claims are decided by the persisted representation, not by rendered
text or a "Saved" label — check whether the walker actually read the value back.

## Lens `visual`

Consistency and polish across themes and window sizes.

Check for: theme parity — an element correct in the default light theme but broken
in another theme or in dark mode (compare shots of the same screen across
scenario dirs); spacing and alignment drift; truncation and overflow with long
names and large numbers; contrast; empty-state layout; artifacts at the smallest
(squeeze) and largest (stretch) supported viewport. A finding must list **every**
shot exhibiting the issue and **every** theme/viewport you checked — including
combinations where it does NOT reproduce.

If pixels omit controls or text that remain present in the accessibility tree, do
not file from the walker shot alone. Re-drive the unchanged state with plain and
stability-styled captures; browsers can intermittently return a partially painted
screenshot.

## Lens `accessibility`

The keyboard and screen-reader experience.

Check for: mismatches between the accessibility snapshot and the pixels (visible
text missing from the tree; a control whose tree name is absent on screen — a
blank button that still announces a name is the canonical example); focus order;
focus visibility (the walker must have skipped outline-suppressing stability
styles for this — if focus rings are invisible in a stability-styled shot, that is
NOT a finding, it is the helper); Escape and Tab behavior in nested dialogs; focus
return after a dialog closes; focus traps; missing name/role on interactive
controls; content conveyed by color alone. An a11y issue that blocks a **core**
flow is high severity, not polish.

Do not infer a defect solely from the snapshot tool serializing a password value,
omitting `aria-current`, or omitting a native validation bubble. These reproduce on
minimal generic browser controls. Redact credentials, verify DOM attributes
directly, and mark packaged/assistive-tech behavior as a coverage gap unless
independently tested.

## Lens `product-copy`

First-impression proxy — does each screen say the right thing, in the right voice?

Check for: tone; jargon leaking to users (internal IDs, raw HTTP status codes,
stack-trace fragments, database field names); onboarding promising something the
app doesn't deliver; error messages a normal person can't act on; terminology
drift (the same concept called three different things across screens);
untranslated or placeholder strings in a shipped locale. Quote the exact string
and cite the shot it appears in.
