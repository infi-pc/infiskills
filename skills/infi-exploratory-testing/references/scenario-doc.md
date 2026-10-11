# Walker artifact contract + scenario.md template

You are a walker. You complete one scenario's goal in the real app and turn the
walk into **evidence someone else can trust without watching you do it**.

## The contract

A scenario is done when:

- `scenario.md` is complete against the template below.
- Every file in `shots/` is referenced from at least one numbered step. A
  screenshot nobody references is noise — delete it or reference it.
- `driver.cjs` replays the walk from a clean start (someone can re-run it with
  `node <scenario-dir>/driver.cjs` from the directory where Playwright resolves).
- Everything you created is deleted, or listed as litter in Coverage gaps.

**Text and screenshots are complementary, not redundant.** A screenshot shows a
frozen frame. The text must supply what the frame cannot:

- That an action was a _drag_ (capture before and after; say it was a drag), a
  _hover_, a _keypress_, a _scroll_.
- Where keyboard _focus_ was — the pixel may not show it, especially mid-flow.
- What the _accessibility tree_ reported at that moment (pair a `[Ax NN]` with
  the `[Shot NN]`).
- _Timing_ — "this took ~2s and showed a spinner", "this flashed then vanished",
  "the first load paid a cold compile".
- What the _network_ did — the request behind a mutation, its status, and
  whether the adapter's read-back confirmed the result.

## Evidence mechanics

- Screenshots: `shots/NN-slug.png`, NN zero-padded in capture order.
- Accessibility snapshots: `ax/NN-slug.txt`, **reusing the same NN** as the
  screenshot they pair with, so "the tree behind Shot 03" is unambiguous. Take
  one per key state, not one per screenshot. When the content under test lives
  in a frame, take a second snapshot inside that frame and name it
  `NN-slug-frame.txt`.
- In `scenario.md`, reference them as `[Shot 03](shots/03-settings-redirects.png)`
  and `[Ax 03](ax/03-settings-redirects.txt)`.
- Redact anything credential-shaped before writing a snapshot or log: session
  cookies, API keys, bearer tokens, passwords.
- Capture console messages, page errors, and failed responses (`status >= 400`).
  Note which console output is the known dev noise named by the adapter and
  which is not.
- Do not judge severity or call things bugs. Record what you observed; ranking is
  the reviewers' and orchestrator's job. Your curiosity belongs in **Anomalies**.
- An aria snapshot is not a verbatim screen-reader transcript. If it omits a DOM
  state, record the limitation and verify the DOM attribute directly rather than
  calling it an application anomaly.
- Persistence claims need the stored value. A toast, a "saved" label, or an
  optimistic UI update is a claim to test — read the value back through the
  adapter, from a fresh load, not from the text on screen.

## scenario.md template

```markdown
# Scenario NN: <title>

| Field         | Value                                            |
| ------------- | ------------------------------------------------ |
| Status        | complete / partial / blocked                     |
| Date          | <date>                                           |
| Surface       | <adapter surface>                                |
| Environment   | <url, port, local or deployed>                   |
| Account       | <the seeded identity, never a real customer>     |
| Viewport(s)   | desktop 1280x720 (+ any others used)             |
| Locale(s)     | <default> (+ any others used)                    |
| Driver        | driver.cjs                                       |
| Created state | <what was created, and whether it was cleaned up> |

## Goal

One sentence, in user language.

## Preconditions and seed

The exact recipe — account, route, headers, viewport, created records, mutated
settings and their original values, route interceptions. Enough that someone can
replay the starting state without reading driver.cjs.

## Walkthrough

1. <User action> — done via <mechanics: click / keyboard / drag from X to Y>.
   Observed: <what happened>. [Shot 01](shots/01-….png) [Ax 01](ax/01-….txt)
   Not visible in shot: <hover state / focus location / animation / timing /
   the request and its status>.
2. ...

## Persistence checks

What was read back from storage, and what it showed. For a publish or save: the
other surface that should reflect it, and what that surface served.

## Accessibility notes

Focus order observed along the path; accessible names encountered; any mismatch
between what the aria tree reports and what the pixels show; axe output path if
one was produced.

## Anomalies noticed

Anything odd, even off-goal — each with a Shot/Ax ref. No severity labels.

## Coverage gaps

What was intended but not covered and why. Anything not testable in this
environment (the adapter's out-of-band list) flagged as such. Any state you
created and could not delete.

## Console and network notes

Errors/warnings seen, split into known dev noise and everything else. Failed
responses with status and URL. The request behind each mutation.

## Blocked (only if status is blocked)

The exact step that stopped you, the alternate route you tried, and stuck-state
evidence (Shot + Ax + console + network).
```
