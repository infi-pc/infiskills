# Reviewer lenses

Each reviewer takes **one** lens and judges the walkers' evidence through it. You
did not run the scenarios; you interrogate what they captured.

## Common rules (apply to every lens)

**Independence.** You work blind to the other reviewers. Do not read other files
in `reviews/`, and do not treat a walker's "Anomalies" as a verdict — treat
everything as raw evidence. Duplication across lenses is signal, not waste;
deduplication is the orchestrator's job. Never soften or drop a finding because
"someone else probably has it".

**Evidence discipline.** A finding without evidence does not exist. Every finding
cites at least one screenshot or accessibility snapshot by path, plus user-level
repro steps. If you claim broken behavior the walker did not itself reproduce,
re-drive the app to confirm before writing it (fresh seeded state; scripts in
`reviews/re-drive/`, shots in `reviews/shots/<lens>-NN-slug.png`). Re-drives obey
the walkers' isolation contract and clean up afterwards. Mark every finding's
confidence: `confirmed-by-re-drive`, `observed-in-evidence`, or `suspected`.

**Adapter awareness.** Read the adapter's noise list and out-of-band surfaces
before filing. Tooling artifacts recorded there are not product defects.
Surfaces declared untestable are coverage gaps, not bugs. If you are unsure
whether something is environment, say so and mark it `suspected`.

**Which surface.** Name the surface from the adapter. Who is hurt is a severity
move the orchestrator applies before the shared matrix. Propose severity and
frequency separately. Do not propose a bare priority.

**Finding format.** Write findings to `reviews/<lens>.md`, each as:

```markdown
### <LENS>-NN: <short title>

- Surface: <adapter surface>
- Proposed severity/frequency: S<n>/F<n> (the orchestrator computes P)
- Confidence: confirmed-by-re-drive | observed-in-evidence | suspected
- Evidence: <paths to shots / ax / scenario.md sections>
- Repro (user steps): 1. ... 2. ... 3. ...
- Expected vs actual: <what a user would expect> / <what happens>
```

End your file with a short **"Noticed outside my lens"** section — one line each,
no expansion. Report it; don't chase it.

---

## Lens `ux-flow`

Can a real person complete each scenario's goal without confusion or a detour?
Use the actor the adapter names for that surface.

Check for: dead ends; missing feedback after an action (did anything confirm it
worked?); surprise modality (a dialog that traps you); unclear next step; moments
that _require_ a workaround; navigation patterns that differ between screens or
between mobile and desktop chrome; misleading progress or status; a destructive
action without confirmation, or a confirmation that does not say what will be
destroyed. State what the user was trying to do and exactly where the flow broke.

## Lens `functional`

Does the app tell the truth and do what it claims? **This lens has the strongest
re-drive duty** — any functional claim the walker did not reproduce must be
re-driven before you file it.

Check for: contradictory simultaneous states (an error banner above an empty-state
"nothing here yet"); UI that stays stale after the underlying state changed; wrong
data shown; affordances that do nothing; error states with no recovery path;
console exceptions and page errors; a request that failed while the UI reported
success; a save the UI claims succeeded but which the adapter's read-back
contradicts; two surfaces that should show the same content disagreeing; links
that 404; a redirect that does not redirect.

Persistence is proven by the stored value, not by rendered text. "The toast said
saved" is a claim, not evidence.

## Lens `visual`

Consistency and polish across viewports, and the fidelity of rendered blocks.

Check for: layout defects at each viewport the run used; spacing and alignment
drift; truncation and overflow with long names and large numbers; contrast;
empty-state layout; images that overflow, stretch, or crop badly; chrome
overlapping the content. A finding must list **every** shot exhibiting the issue
and **every** viewport you checked — including combinations where it does NOT
reproduce.

If pixels omit controls or text that remain present in the accessibility tree,
do not file from the walker shot alone. Re-drive the unchanged state with plain
and stabilized captures; browsers can intermittently return a partially painted
screenshot. When the adapter says local image bytes differ from production, file
the geometry, not the bytes.

## Lens `accessibility`

The keyboard and screen-reader experience, and the axe output when a walker
produced one.

Check for: mismatches between the accessibility snapshot and the pixels (visible
text missing from the tree; a control whose tree name is absent on screen — a
blank button that still announces a name is the canonical example); interactive
elements nested inside other interactive elements; focus order; focus visibility.
The walker template preserves focus outlines when asked. An invisible focus ring
in a shot that suppressed outlines is the helper, not a finding. An invisible
ring in a shot that kept them is evidence. Also check Escape and Tab in nested
dialogs, focus return after a dialog closes, focus traps, missing name or role,
headings that skip levels, and a control the walker could not name with a role
locator — that is itself an accessibility defect.

An accessibility issue that blocks a core flow named by the adapter is high
severity, not polish. Automated checker output is evidence, not a verdict: tie
each hit to what a user would experience, and drop hits the project's suite
already excludes.

## Lens `content-i18n`

First impressions and words, in every language the run touched.

Check for: tone; jargon leaking to users (internal ids, raw HTTP status codes,
stack-trace fragments, database field names); error messages a normal person
cannot act on; terminology drift (the same concept called three different things);
empty or untranslated strings in a shipped locale; source-language text leaking
into a translated page; text that overflows its control once translated; number
and date formatting that does not match the selected locale. Quote the exact
string and cite the shot it appears in. Use this lens when the adapter says the
product ships more than one language, or when the copy itself is the thing under
test.

## Lens `tenancy` (optional — only for multi-tenant runs)

Add this lens only when the adapter says the product isolates tenants and the run
walked more than one. It is black-box only: you are looking for one tenant's
content or configuration appearing under another's identity.

Check for: content, branding, or settings from tenant A rendered for tenant B; a
link on A's surface pointing at B; A's workspace listing B's records; a page that
changes after visiting a different tenant in the same session (a cache-key bug);
behaviour that looks hardcoded to one tenant rather than configuration-driven.
Cross-tenant exposure is S0 — and it is also the easiest thing to imagine from a
shared-looking screenshot, so re-drive with two clean contexts captured side by
side before filing.
