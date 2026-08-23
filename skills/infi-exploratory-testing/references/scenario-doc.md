# Walker artifact contract + scenario.md template

You are a walker. You complete one scenario's goal in the real app and turn the
walk into **evidence someone else can trust without watching you do it**.

## The contract

A scenario is done when:

- `scenario.md` is complete against the template below.
- Every file in `shots/` is referenced from at least one numbered step. A
  screenshot nobody references is noise — delete it or reference it.
- `driver.cjs` replays the walk against a fresh session (someone can re-run it).

**Text and screenshots are complementary, not redundant.** A screenshot shows a
frozen frame. The text must supply what the frame cannot:

- That an action was a *drag* (capture before and after; say it was a drag), a
  *hover*, a *keypress*, a *scroll*.
- Where keyboard *focus* was — the pixel may not show it, especially mid-flow.
- What the *accessibility tree* reported at that moment (pair an `[Ax NN]` with
  the `[Shot NN]`).
- *Timing* — "this took ~2s and showed a spinner", "this flashed then vanished".

## Evidence mechanics

- Screenshots: `shots/NN-slug.png`, NN zero-padded in capture order.
- Accessibility snapshots: `ax/NN-slug.txt`, **reusing the same NN** as the
  screenshot they pair with, so "the tree behind Shot 03" is unambiguous. Take
  one per key state, not one per screenshot.
- Before writing a snapshot, redact password values, bearer tokens, and any other
  credential material. Playwright can serialize password inputs in plain text
  even though the control is visually masked.
- In `scenario.md`, reference them as `[Shot 03](shots/03-settings.png)` and
  `[Ax 03](ax/03-settings.txt)`.
- Capture console errors/warnings and any network request that fired. For offline
  steps, record whether ANY request reached the backend (it must not).
- Persistence claims read the persisted representation back through the adapter's
  inspection API. A visible "Saved" label and a passing idle check are not
  persistence evidence.

Do not judge severity or call things bugs. Record what you observed; ranking is
the reviewers' and orchestrator's job. Your curiosity belongs in **Anomalies**.

An accessibility snapshot is not a verbatim screen-reader transcript. If it omits
a DOM state such as `aria-current`, or omits native validation feedback, record
the limitation and verify the DOM/browser behavior separately before calling it
an application anomaly.

## scenario.md template

```markdown
# Scenario NN: <title>

| Field | Value |
|---|---|
| Status | complete / partial / blocked |
| Date / Surface | <date> / <surface, e.g. web app via dev server> |
| Viewport(s) | 1280x720 (+ any others used) |
| Seeded state | none (anonymous) / <fresh account or fixture id> |
| Driver | driver.cjs |

## Goal
One sentence, in user language.

## Preconditions and seed
The exact recipe — storage keys, cookies, seeded account or fixture records,
route interceptions, viewport, theme, locale. Enough that someone can replay the
starting state WITHOUT reading driver.cjs.

## Walkthrough
<!-- WALKER_STEPS -->
1. <User action> — done via <mechanics: click / keyboard shortcut / Tab / drag
   from X to Y>. Observed: <what happened>.
   [Shot 01](shots/01-....png) [Ax 01](ax/01-....txt)
   Not visible in shot: <hover state / focus location / animation / timing>.
2. ...

## Accessibility notes
Focus order observed along the path; accessible names encountered; any mismatch
between what the accessibility tree reports and what the pixels show.

## Anomalies noticed
Anything odd, even off-goal — each with a Shot/Ax ref. No severity labels.

## Coverage gaps
What was intended but not covered and why. Out-of-band surfaces touched (the
adapter's untestable list) flagged as not testable here.

## Console and network notes
Errors/warnings seen. Unexpected requests — especially any request that reached
the backend while the app was offline.

## Blocked (only if status is blocked)
The exact step that stopped you, the alternate route you tried, and stuck-state
evidence (Shot + Ax + console).
```

Keep the `<!-- WALKER_STEPS -->` marker while the walk is in progress. The
bundled driver's `capture` helper inserts each numbered action and observation
at that marker immediately after it writes the evidence pair. Remove the marker
and the placeholder example only when finalizing the scenario.
