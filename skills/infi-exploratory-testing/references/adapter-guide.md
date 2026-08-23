# Writing a project adapter

The skill owns the *process*. The adapter owns *this app*. A run without an
adapter degenerates into four walkers independently rediscovering how to log in,
so write the adapter once and check it into the project.

Save it where the next run will find it: a path named by the project
instructions, or `<project>/.agents/exploratory-adapter.md`, or as a section in
the project's existing `TESTING.md`. Record the path in `run.md` every run.

If the app is an ordinary web app reachable over HTTP,
[`web-recipes.md`](web-recipes.md) is already a working adapter — start there
and extend it rather than writing from scratch.

## The checklist

An adapter is complete when a walker who has read only the adapter and its
scenario brief can boot the app, reach the first product action, and prove
persistence. Every section below must be answerable.

### 1. Boot

- The exact command that starts the app or dev server, and whether it must run
  from a particular directory.
- Every port it binds, and whether the ports are strict (fixed) or dynamic.
- The **readiness check** — a URL or command that succeeds only once the app is
  actually usable. Include the realistic cold-boot time and what makes it slow
  (migrations, bundling, index warm-up). Walkers must await this, never sleep.
- **What boot destroys.** If starting the server wipes a test database, clears
  fixture storage, or invalidates seeded accounts, say so in capitals. That
  single fact is why the orchestrator owns the server.
- The URL walkers navigate to, including any test-mode query string or path.

### 2. Browser and driver

- Where `@playwright/test` (or the project's driver library) resolves from, so
  walkers know which directory to run `node driver.cjs` from.
- Which browser engines the product supports, and which one is the default for
  walking. A disagreement between two supported engines is a product finding.
- Any launch flags, proxy settings, or certificate trust the app requires.
- The selector that means "the app shell has mounted" — the walker template's
  `settle()` waits on it. Without a correct value, every capture races the
  first paint.

### 3. Seeding state

This is the section that decides whether a run can reach interesting states.

- **Local/page-scoped state** — how to set it before navigation: an init script,
  a config global, `localStorage` keys, cookies, a URL parameter. List the keys
  that matter (theme, locale, onboarding-complete, feature flags) with their
  legal values and defaults.
- **Shared server state** — the command that creates a *fresh* account, tenant,
  organisation, or fixture record, and exactly what it prints or returns
  (credentials, IDs, tokens). State plainly that each scenario and each reviewer
  re-drive gets its own, and that no walker may reuse another's.
- **Existing helpers** — point at the project's own end-to-end fixtures and
  helpers by path. Reusing them beats reinventing a login flow, and it keeps
  exploratory drivers honest about how the app really boots.
- **Determinism controls** — seeded randomness, frozen clocks, fixed IDs, stable
  avatars. Anything that makes two runs of the same driver produce different
  pixels needs a control here or a documented exclusion.

### 4. Reaching non-happy states

Most real findings live outside the happy path, and walkers cannot reach those
states by clicking. Give a concrete recipe for each state class the product has:

- **Empty** — how to boot with nothing in it.
- **Loading** — how to hold a response open (gate the route behind a promise you
  resolve after capturing), and which routes are worth gating.
- **Error** — how to force a 4xx/5xx or a malformed payload for a named
  endpoint.
- **Offline / degraded** — how to cut network access, and how to *assert* that no
  request leaked to the backend while offline (a request counter or a blocking
  route, not a vibe).
- **Permission denied** — how to seed a user who lacks a capability.
- **Oversized / truncating** — long names, large payloads, many rows, deep
  nesting. Name the fields worth stressing.
- **Slow transitions** — if the app has a read/write gate or an artificial delay
  hook, document it. It replaces sleeps when a scenario must act *during* a
  pending operation.

For each recipe, say what a walker must **not** assert yet. Gating a write means
provisional UI state exists before durable state does; asserting persistence at
that checkpoint produces a false finding.

### 5. Inspecting truth

- The **persisted representation** and how to read it: file bytes through a test
  API, a database query, an authenticated API read-back. Durability claims use
  this, never rendered text.
- Any app-provided **idle or pass-count signal** walkers can await instead of
  sleeping (a `waitForIdle`, a sync-pass counter, an open-socket count, a
  quiesced-network helper).
- Which app-internal events walkers may emit to navigate deterministically
  (opening a settings tab, triggering a refresh) rather than clicking through
  several screens.
- Known evidence-tool limitations. For example, Playwright's `ariaSnapshot()`
  serializes password input values in plain text and omits some states such as
  `aria-current`; these are tool artifacts on ordinary controls, not product
  defects. List the ones this project has already been burned by, so no reviewer
  files them again.

### 6. Viewports, themes, locales

- The viewport sizes the product supports; name the smallest (squeeze) and
  largest (stretch) worth capturing.
- Every theme and colour scheme, how to set each, and how they surface in the
  DOM.
- Every **supported** locale and how to set it. Say explicitly which locales are
  present in the repo but not loaded — otherwise a reviewer files "translations
  missing" against a language the product does not ship.

### 7. Out-of-band surfaces

List what this harness structurally cannot test, so walkers flag instead of
attempting and reviewers do not file it. Typical entries: OS keychains and
credential stores, native file dialogs, real filesystem event semantics,
tray/menu/notification delivery, auto-updater install and relaunch, code signing
and notarization, push delivery, third-party payment or OAuth provider UIs,
exact native webview rendering, hardware sensors.

Every item here becomes a line in the run's coverage-gap section.

### 8. Etiquette under parallel walkers

Be explicit about which surfaces are **page-local** (init scripts, route
interception, per-context storage, offline toggles — these never collide) and
which are **shared** (the server, the test database, a queue, an object store).
Then state the one rule that follows: fresh shared state per walker, and nobody
restarts the server.

## Keeping the adapter honest

The adapter is not documentation to be admired; it is executable knowledge that
rots. After every run, fold the corrections back in:

- A recipe that no longer works gets fixed here, in the same pass that noticed
  it.
- A selector or timing assumption that broke a driver gets replaced with the
  robust version.
- A false finding that traced back to a tooling artifact gets recorded in
  *Inspecting truth* so the next reviewer skips it.
- A state class the run could not reach gets a recipe, or an explicit entry in
  *Out-of-band surfaces*.

An adapter that has survived three runs unchanged is either excellent or unread.
Check which.
