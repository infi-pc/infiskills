// Walker driver template for exploratory testing.
//
// Copy this into your scenario dir as `driver.cjs`, fill in the CONFIG and the
// WALK, and run it from a directory where `@playwright/test` resolves:
//
//   cd <dir containing node_modules/@playwright/test>
//   node <run-dir>/scenarios/NN-slug/driver.cjs > console.log 2>&1
//
// Prereq: the ORCHESTRATOR has the app server running. Do NOT start, stop, or
// restart it yourself — on many projects a restart wipes shared test state that
// other walkers are still using.
//
// Output lands next to this script (shots/ and ax/) regardless of cwd.

const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require(require.resolve('@playwright/test', { paths: [process.cwd()] }));

const HERE = __dirname;
const SHOTS = path.join(HERE, 'shots');
const AX = path.join(HERE, 'ax');
const SCENARIO = path.join(HERE, 'scenario.md');

// ---- CONFIG: set these from the project adapter ----
const APP_URL = process.env.APP_URL || 'http://127.0.0.1:3000/';
// A selector that exists only once the app has actually mounted. `body` is not
// good enough — it exists before the app does, so every capture races the first
// paint. Get the right value from the adapter.
const APP_READY_SELECTOR = process.env.APP_READY_SELECTOR || '#root';
// Origins the app legitimately talks to. Everything else is aborted so a slow
// CDN cannot destabilise a capture. Add your backend origin here.
const ALLOWED_HOSTS = ['127.0.0.1', 'localhost'];
// Backend origins that must receive ZERO requests while `offline` is true.
const BACKEND_MARKERS = ['127.0.0.1', 'localhost'];
const VIEWPORT = { width: 1280, height: 720 };

// Deterministic-screenshot styles. Note the outline suppression — keyboard/focus
// scenarios must NOT apply this (pass { focus: true } to capture).
const STABLE_STYLES = `
  *, *::before, *::after {
    animation: none !important;
    caret-color: transparent !important;
    scroll-behavior: auto !important;
    transition: none !important;
  }
  :focus, :focus-visible { outline: none !important; }
`;

// Same deterministic motion/caret rules, but preserve focus indicators for
// keyboard scenarios. Skipping ALL stability CSS here would trade a false
// accessibility finding for jittery pixels; keep the motion rules.
const FOCUS_STABLE_STYLES = `
  *, *::before, *::after {
    animation: none !important;
    caret-color: transparent !important;
    scroll-behavior: auto !important;
    transition: none !important;
  }
`;

async function settle(page, { keepFocusStyles = false } = {}) {
  await page.locator(APP_READY_SELECTOR).first().waitFor();
  await page.evaluate(async () => document.fonts.ready);
  await page.addStyleTag({ content: keepFocusStyles ? FOCUS_STABLE_STYLES : STABLE_STYLES });
  await page.evaluate(
    () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
  );
}

// Accept evidence only after two consecutive capture windows agree on semantic
// DOM + accessibility state. Within that stable state, keep the denser of the
// two PNGs to guard against the occasional partially painted frame.
async function captureStableEvidence(page) {
  const body = page.locator('body');
  const ariaSnapshot = async () => {
    let aria = await body.ariaSnapshot();
    // Playwright serializes password values in plain text. Never write them out.
    const secrets = await page.locator('input[type="password"]').evaluateAll((inputs) =>
      inputs.map((input) => input.value).filter(Boolean),
    );
    for (const secret of secrets) aria = aria.split(secret).join('[REDACTED]');
    return aria;
  };
  let previous;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    await page.evaluate(
      () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
    );
    const textBefore = await body.innerText();
    const ariaBefore = await ariaSnapshot();
    const png = await page.screenshot({ animations: 'allow' });
    const textAfter = await body.innerText();
    const ariaAfter = await ariaSnapshot();
    const signature = JSON.stringify([textAfter, ariaAfter]);
    if (textBefore === textAfter && ariaBefore === ariaAfter
      && previous?.signature === signature) {
      return {
        aria: ariaAfter,
        png: previous.png.length > png.length ? previous.png : png,
      };
    }
    previous = textBefore === textAfter && ariaBefore === ariaAfter
      ? { png, signature }
      : undefined;
  }
  throw new Error('Evidence state did not remain semantically stable across two captures');
}

function recordStep(id, { action, observed, note = 'None.' }) {
  if (!action || !observed) {
    throw new Error('capture requires action and observed narration');
  }
  const markdown = fs.readFileSync(SCENARIO, 'utf8');
  const marker = '<!-- WALKER_STEPS -->';
  if (!markdown.includes(marker)) {
    throw new Error(`scenario.md must contain ${marker} before capture`);
  }
  const number = id.slice(0, 2).replace(/^0/, '');
  const step = `${number}. ${action}\n`
    + `   Observed: ${observed}. [Shot ${id.slice(0, 2)}](shots/${id}.png) `
    + `[Ax ${id.slice(0, 2)}](ax/${id}.txt)\n`
    + `   Not visible in shot: ${note}\n`;
  fs.writeFileSync(SCENARIO, markdown.replace(marker, `${step}${marker}`));
}

(async () => {
  // Check the orchestrator-owned server before touching prior evidence. A
  // failed connection is a blocker; it must not erase the last good replay.
  const health = await fetch(APP_URL);
  if (!health.ok) throw new Error(`App unavailable: ${health.status} ${health.statusText}`);
  for (const dir of [SHOTS, AX]) {
    fs.mkdirSync(dir, { recursive: true });
    for (const entry of fs.readdirSync(dir)) fs.unlinkSync(path.join(dir, entry));
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: VIEWPORT });
  const page = await context.newPage();
  page.setDefaultTimeout(15_000);

  // ---- Evidence + console/network capture ----
  let n = 0;
  let offline = false; // flip true around offline steps; any backend hit is a defect
  const offlineLeaks = [];
  const pad = (i) => String(i).padStart(2, '0');

  // capture writes a matching evidence pair and immediately inserts its
  // numbered narration at <!-- WALKER_STEPS --> in scenario.md.
  async function capture(slug, { action, observed, note, focus = false } = {}) {
    n += 1;
    const id = `${pad(n)}-${slug}`;
    await settle(page, { keepFocusStyles: focus });
    const evidence = await captureStableEvidence(page);
    fs.writeFileSync(path.join(SHOTS, `${id}.png`), evidence.png);
    fs.writeFileSync(path.join(AX, `${id}.txt`), evidence.aria);
    recordStep(id, { action, observed, note });
    console.log(`CAPTURE ${id}`);
    return id;
  }

  page.on('console', (m) => console.log(`CONSOLE[${m.type()}] ${m.text()}`));
  page.on('pageerror', (e) => console.log(`PAGEERROR ${e.message}`));
  page.on('request', (r) => {
    if (offline && BACKEND_MARKERS.some((h) => r.url().includes(h))) {
      offlineLeaks.push(r.url());
      console.log(`OFFLINE_LEAK ${r.url()}`);
    }
  });

  // Block third-party traffic so an external CDN cannot destabilise a capture.
  // Registered FIRST so any scenario-specific route added later wins (Playwright
  // matches handlers in reverse registration order).
  await page.route('**/*', (route) => {
    const { protocol, hostname } = new URL(route.request().url());
    if (protocol !== 'http:' && protocol !== 'https:') return route.continue();
    return ALLOWED_HOSTS.includes(hostname) ? route.continue() : route.abort();
  });

  // ---- CONFIG: set the starting state BEFORE navigation ----
  // See the project adapter (or references/web-recipes.md) for the real keys.
  await page.addInitScript(() => {
    // localStorage.setItem('onboarded', 'true');
    // localStorage.setItem('theme', 'light');
    Math.random = () => 0.42; // determinism; drop if the app needs real entropy
  });
  // Authenticated start: prefer a fresh seeded account from the adapter's seed
  // command, or a storageState captured once per run. Never share a mutable
  // account with another walker.

  await page.goto(APP_URL);

  // ---- WALK: drive the scenario, capturing at each key state ----
  // Use role/name locators. Never sleep — await locators, responses, or state.
  //
  // Forced states (page-local, safe under parallel walkers):
  //   await page.route('**/api/items*', (r) => r.fulfill({ status: 500, json: { error: 'boom' } }));
  //   let release; const gate = new Promise((r) => { release = r; });
  //   await page.route('**/api/items*', async (rt) => { await gate; await rt.continue(); });
  //   offline = true; await context.setOffline(true);  // ... then restore both
  //
  // Persistence evidence — read the value back, never trust rendered text:
  //   const res = await page.request.get('/api/items/42');
  //
  // await capture('detail-initial', {
  //   action: 'Opened the seeded item from the list with the pointer.',
  //   observed: 'The detail pane showed the exact seeded title and body',
  //   note: 'Focus stayed on the list row; no animation or warning appeared.',
  // });

  await capture('start', {
    action: `Opened ${APP_URL}.`,
    observed: 'The app shell mounted and rendered its initial view',
    note: 'This is the starting state before scenario-specific actions.',
  });

  if (offlineLeaks.length) {
    console.log(`OFFLINE_LEAK_TOTAL ${offlineLeaks.length}`);
  }

  await browser.close();
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
