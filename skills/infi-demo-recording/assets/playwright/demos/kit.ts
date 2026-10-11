/**
 * Demo kit — turns a Playwright run into a narrated, human-watchable demo.
 *
 * What it adds on top of a plain test:
 *  - a visible animated cursor that travels to every target (`glideClick`)
 *  - a caption bar + title cards for on-screen narration
 *  - voiceover: each narration line is synthesized (ElevenLabs — see tts.ts)
 *    and logged into `narration.json`; at the moment a line starts, a small
 *    magenta sync marker is flashed on screen so
 *    `scripts/demo-postprocess.mjs` can read the line's true video timestamp
 *    back from the pixels (wall-clock offsets drift against the screencast),
 *    place the audio exactly there, and paint the marker back out
 *  - pacing: a beat holds exactly as long as its narration needs, so the
 *    video is neither rushed nor padded; actions can anchor extra lines
 *    mid-flight via `narrate` so outcomes are spoken when they are visible
 *
 * Usage (see *.demo.ts files):
 *   import { demoTest, beat, title, glideClick } from "./kit";
 *   demoTest("delete page", async ({ page }) => {
 *     await title({ say: "..." });
 *     await beat({ caption: "...", say: "...", action: async () => {...} });
 *   });
 */

import fs from "node:fs";
import path from "node:path";
import {
  test as base,
  type Locator,
  type Page,
  type TestInfo,
} from "@playwright/test";
import {
  describeProvider,
  estimateDurationMs,
  lookup,
  synthesize,
} from "./tts";

interface NarrationEvent {
  text: string;
  file: string;
  offsetMs: number;
  durationMs: number;
  /** True when the clip wasn't cached, so the beat paced on an estimate. */
  estimated: boolean;
}

interface DemoSession {
  page: Page;
  testInfo: TestInfo;
  t0: number;
  events: NarrationEvent[];
  /** Background synthesis, awaited at teardown. */
  pending: Promise<void>[];
  cursor: { x: number; y: number };
  /** Wall-clock time when the currently playing narration line ends. */
  narrationEndsAt: number;
}

let session: DemoSession | null = null;

function mustSession(): DemoSession {
  if (!session) {
    throw new Error(
      "No demo session — use `demoTest` from kit.ts instead of the plain `test`.",
    );
  }
  return session;
}

/* ------------------------------------------------------------------ */
/* Overlay chrome: cursor, caption bar, title card (top frame only)    */
/* ------------------------------------------------------------------ */

async function installDemoChrome(page: Page): Promise<void> {
  await page.addInitScript(() => {
    // Only the top document gets the overlay — an application's iframe
    // would otherwise render a second caption bar inside the preview.
    if (window !== window.top) return;
    if ((window as unknown as Record<string, unknown>).__demoChromeInstalled)
      return;
    (window as unknown as Record<string, unknown>).__demoChromeInstalled = true;

    const mount = () => {
      if (document.getElementById("__demo_cursor")) return;

      // Cursor: classic pointer arrow with a soft halo, driven explicitly
      // from the test via __demoCursor(x, y) so it works over iframes too.
      const cursor = document.createElement("div");
      cursor.id = "__demo_cursor";
      Object.assign(cursor.style, {
        position: "fixed",
        left: "0",
        top: "0",
        zIndex: "2147483647",
        pointerEvents: "none",
        opacity: "0",
        transition: "opacity .25s ease",
        filter: "drop-shadow(0 1px 2px rgba(0,0,0,.45))",
      });
      cursor.innerHTML =
        '<svg width="26" height="30" viewBox="0 0 26 30">' +
        '<path d="M2 1 L2 22 L7.5 17.5 L11 26 L15 24.3 L11.5 16 L19 15.5 Z" ' +
        'fill="#fff" stroke="#111" stroke-width="1.6" stroke-linejoin="round"/></svg>';

      const halo = document.createElement("div");
      halo.id = "__demo_halo";
      Object.assign(halo.style, {
        position: "fixed",
        left: "0",
        top: "0",
        width: "38px",
        height: "38px",
        zIndex: "2147483646",
        pointerEvents: "none",
        borderRadius: "50%",
        border: "2px solid rgba(90,140,255,.9)",
        background: "rgba(90,140,255,.25)",
        transform: "translate(-50%,-50%) scale(0)",
        opacity: "0",
      });

      // Caption bar: top-centered pill.
      const caption = document.createElement("div");
      caption.id = "__demo_caption";
      Object.assign(caption.style, {
        position: "fixed",
        left: "50%",
        top: "26px",
        transform: "translateX(-50%) translateY(8px)",
        maxWidth: "min(880px, 82vw)",
        zIndex: "2147483645",
        pointerEvents: "none",
        font: "500 17px/1.5 ui-sans-serif, system-ui, sans-serif",
        letterSpacing: ".01em",
        color: "#fff",
        background: "rgba(16,17,20,.86)",
        backdropFilter: "blur(8px)",
        padding: "12px 22px",
        borderRadius: "12px",
        boxShadow: "0 6px 24px rgba(0,0,0,.35)",
        opacity: "0",
        transition: "opacity .25s ease, transform .25s ease",
        textAlign: "center",
      });

      // Narration sync marker: a small pure-magenta square flashed at the
      // start of every spoken line. demo-postprocess.mjs detects the flashes
      // in the pixels (magenta = extreme U+V chroma nothing in the UI
      // reaches), aligns each audio clip to its true video timestamp, then
      // erases the square with a delogo filter. Position and size must match
      // the MARKER constant in that script.
      const mark = document.createElement("div");
      mark.id = "__demo_mark";
      Object.assign(mark.style, {
        position: "fixed",
        left: "2px",
        top: "2px",
        width: "12px",
        height: "12px",
        zIndex: "2147483647",
        pointerEvents: "none",
        background: "#f0f",
        display: "none",
      });
      let markTimer: ReturnType<typeof setTimeout> | undefined;

      // Title card: dimmed backdrop + centered heading.
      const titleWrap = document.createElement("div");
      titleWrap.id = "__demo_title";
      Object.assign(titleWrap.style, {
        position: "fixed",
        inset: "0",
        zIndex: "2147483644",
        pointerEvents: "none",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(10,11,14,.62)",
        backdropFilter: "blur(3px)",
        opacity: "0",
        transition: "opacity .35s ease",
      });
      const titleText = document.createElement("div");
      Object.assign(titleText.style, {
        maxWidth: "760px",
        font: "600 32px/1.35 ui-sans-serif, system-ui, sans-serif",
        color: "#fff",
        textAlign: "center",
        padding: "0 40px",
        textShadow: "0 2px 12px rgba(0,0,0,.5)",
      });
      titleWrap.appendChild(titleText);

      document.documentElement.append(titleWrap, caption, halo, cursor, mark);

      const api = {
        cursor(x: number, y: number) {
          cursor.style.opacity = "1";
          cursor.style.left = `${x}px`;
          cursor.style.top = `${y}px`;
          halo.style.left = `${x}px`;
          halo.style.top = `${y}px`;
        },
        pulse() {
          halo.style.transition = "none";
          halo.style.transform = "translate(-50%,-50%) scale(.4)";
          halo.style.opacity = "1";
          requestAnimationFrame(() => {
            halo.style.transition = "transform .45s ease, opacity .45s ease";
            halo.style.transform = "translate(-50%,-50%) scale(1.4)";
            halo.style.opacity = "0";
          });
        },
        caption(text: string) {
          if (text) {
            caption.textContent = text;
            caption.style.opacity = "1";
            caption.style.transform = "translateX(-50%) translateY(0)";
          } else {
            caption.style.opacity = "0";
            caption.style.transform = "translateX(-50%) translateY(8px)";
          }
        },
        title(text: string) {
          if (text) {
            titleText.textContent = text;
            titleWrap.style.opacity = "1";
          } else {
            titleWrap.style.opacity = "0";
          }
        },
        mark() {
          // No transition — the flash must be a crisp on/off for detection.
          mark.style.display = "block";
          clearTimeout(markTimer);
          markTimer = setTimeout(() => {
            mark.style.display = "none";
          }, 180);
        },
      };
      (window as unknown as Record<string, unknown>).__demo = api;
    };

    if (document.readyState === "loading") {
      addEventListener("DOMContentLoaded", mount);
    } else {
      mount();
    }
  });
}

type DemoApiCall = "cursor" | "pulse" | "caption" | "title" | "mark";

async function callChrome(
  page: Page,
  fn: DemoApiCall,
  ...args: (string | number)[]
): Promise<void> {
  await page
    .evaluate(
      ({ fn: method, args: methodArgs }) => {
        const api = (
          window as unknown as {
            __demo?: Record<string, (...a: unknown[]) => void>;
          }
        ).__demo;
        api?.[method]?.(...methodArgs);
      },
      { fn, args },
    )
    .catch(() => {
      // Navigation mid-call — the overlay remounts on the next page; a lost
      // cosmetic update must never fail the demo.
    });
}

/* ------------------------------------------------------------------ */
/* Voiceover                                                           */
/* ------------------------------------------------------------------ */

/** Minimum silence between two narration lines. */
const LINE_GAP_MS = 350;

/**
 * Start a narration line "now": wait out any still-playing line (two lines
 * must never overlap in the final mix), flash the sync marker, and register
 * the line in the manifest. Resolves when the line has *started*, not when
 * it has finished — the demo keeps moving while the voice speaks, and
 * beat()/title() hold at their end until `narrationEndsAt`.
 *
 * A cached clip gives an exact duration. An uncached one is generated in the
 * background — the recording must not stall on an HTTP request — and pacing
 * falls back to an estimate, with the real duration patched into
 * `narration.json` at teardown. Such a take is marked `estimated` and should
 * be re-recorded off the warm cache.
 */
async function cueNarration(text: string): Promise<void> {
  const s = mustSession();
  const wait = s.narrationEndsAt + LINE_GAP_MS - Date.now();
  if (wait > 0) await s.page.waitForTimeout(wait);
  // Flash the sync marker at the exact moment the line is considered started;
  // postprocess reads the flash back from the pixels to place the audio.
  await callChrome(s.page, "mark");
  const offsetMs = Date.now() - s.t0;
  const cached = lookup(text);
  if (cached) {
    s.events.push({
      text,
      file: cached.file,
      offsetMs,
      durationMs: cached.durationMs,
      estimated: false,
    });
    s.narrationEndsAt = s.t0 + offsetMs + cached.durationMs;
    return;
  }

  const estimate = estimateDurationMs(text);
  const event: NarrationEvent = {
    text,
    file: "",
    offsetMs,
    durationMs: estimate,
    estimated: true,
  };
  s.events.push(event);
  s.narrationEndsAt = s.t0 + offsetMs + estimate;
  s.pending.push(
    synthesize(text).then((clip) => {
      event.file = clip.file;
      event.durationMs = clip.durationMs;
    }),
  );
}

/* ------------------------------------------------------------------ */
/* Beats: narrated steps with pacing tied to the narration length      */
/* ------------------------------------------------------------------ */

/** Helpers handed to a beat's action. */
export interface BeatCue {
  /**
   * Speak a line anchored to this exact moment of the action — use it right
   * after the visual it describes is on screen ("…and the page is gone").
   * Resolves once the line has started (after waiting out the previous line);
   * the beat's closing hold covers the tail.
   */
  narrate: (text: string) => Promise<void>;
}

export interface BeatOptions {
  /** Shown in the caption bar. */
  caption: string;
  /** Spoken narration; defaults to the caption text. */
  say?: string;
  /** The on-screen work of this beat (glide, click, expect…). */
  action?: (cue: BeatCue) => Promise<void>;
  /** Extra hold after both the action and the narration finished. */
  holdMs?: number;
}

/**
 * One narrated step. Shows the caption, starts the voiceover, gives the
 * viewer a moment to read, runs the action (which may anchor further lines
 * via `narrate`), then holds until the last line has finished (plus `holdMs`
 * breathing room).
 */
export async function beat(opts: BeatOptions): Promise<void> {
  const { caption, say = caption, action, holdMs = 600 } = opts;
  await base.step(caption, async () => {
    const s = mustSession();
    await callChrome(s.page, "caption", caption);
    await cueNarration(say);
    const start = Date.now();
    // Let the caption land and the narration begin before hands move.
    await s.page.waitForTimeout(500);
    if (action) await action({ narrate: cueNarration });
    // An action that navigates (redirect or reload) remounts
    // the overlay without a caption — re-assert it so it stays on screen.
    await callChrome(s.page, "caption", caption);
    // Hold until the last narration line of this beat has finished — but
    // never let a beat flash by in under 2s.
    const target = Math.max(s.narrationEndsAt + holdMs, start + 2000);
    const remaining = target - Date.now();
    if (remaining > 0) await s.page.waitForTimeout(remaining);
  });
}

/** Full-screen title card — use to open and close the demo. */
export async function title(opts: {
  caption: string;
  say?: string;
  holdMs?: number;
}): Promise<void> {
  const { caption, say = caption, holdMs = 700 } = opts;
  await base.step(`title: ${caption}`, async () => {
    const s = mustSession();
    await callChrome(s.page, "caption", "");
    await callChrome(s.page, "title", caption);
    const start = Date.now();
    await cueNarration(say);
    const target = Math.max(s.narrationEndsAt + holdMs, start + 2200);
    const remaining = target - Date.now();
    if (remaining > 0) await s.page.waitForTimeout(remaining);
    await callChrome(s.page, "title", "");
    await s.page.waitForTimeout(350);
  });
}

/* ------------------------------------------------------------------ */
/* Cursor choreography                                                 */
/* ------------------------------------------------------------------ */

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/**
 * Move the visible cursor to the target like a human would. Playwright
 * teleports the mouse by default, which reads as unexplained jump cuts.
 */
export async function glide(
  target: Locator,
  opts: { settleMs?: number } = {},
): Promise<{ x: number; y: number }> {
  const s = mustSession();
  const page = s.page;
  await target.scrollIntoViewIfNeeded();
  await page.waitForTimeout(150); // let scroll settle before measuring
  const box = await target.boundingBox();
  if (!box) throw new Error(`glide: target has no bounding box`);
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;

  const from = s.cursor;
  const dist = Math.hypot(x - from.x, y - from.y);
  const steps = Math.max(14, Math.min(38, Math.round(dist / 26)));
  for (let i = 1; i <= steps; i++) {
    const t = easeInOutCubic(i / steps);
    const px = from.x + (x - from.x) * t;
    const py = from.y + (y - from.y) * t;
    await page.mouse.move(px, py);
    await callChrome(page, "cursor", px, py);
    await page.waitForTimeout(11);
  }
  s.cursor = { x, y };
  await page.waitForTimeout(opts.settleMs ?? 160);
  return { x, y };
}

/** Glide to the target, show a click pulse, and click it. */
export async function glideClick(target: Locator): Promise<void> {
  const s = mustSession();
  const { x, y } = await glide(target);
  await callChrome(s.page, "pulse");
  await s.page.mouse.down();
  await s.page.waitForTimeout(90);
  await s.page.mouse.up();
  // Re-anchor the overlay: a click often opens layers (modals) that repaint.
  await callChrome(s.page, "cursor", x, y);
  await s.page.waitForTimeout(180);
}

/** Glide to an input, click it, and type at human speed. */
export async function glideType(target: Locator, text: string): Promise<void> {
  await glideClick(target);
  await target.pressSequentially(text, { delay: 45 });
}

/** Flash a spotlight ring around an element to draw the eye. */
export async function spotlight(
  target: Locator,
  opts: { holdMs?: number } = {},
): Promise<void> {
  const s = mustSession();
  const holdMs = opts.holdMs ?? 1300;
  await target.scrollIntoViewIfNeeded();
  await s.page.waitForTimeout(150);
  const box = await target.boundingBox();
  if (!box) return;
  await s.page
    .evaluate(
      ({ box: b, holdMs: hold }) => {
        const ring = document.createElement("div");
        Object.assign(ring.style, {
          position: "fixed",
          zIndex: "2147483643",
          pointerEvents: "none",
          left: `${b.x - 8}px`,
          top: `${b.y - 8}px`,
          width: `${b.width + 16}px`,
          height: `${b.height + 16}px`,
          border: "3px solid rgba(90,140,255,.95)",
          borderRadius: "12px",
          boxShadow: "0 0 0 9999px rgba(0,0,0,.30)",
          opacity: "0",
          transition: "opacity .3s ease",
        });
        document.documentElement.appendChild(ring);
        requestAnimationFrame(() => (ring.style.opacity = "1"));
        setTimeout(() => {
          ring.style.opacity = "0";
          setTimeout(() => ring.remove(), 350);
        }, hold);
      },
      { box, holdMs },
    )
    .catch(() => {});
  await s.page.waitForTimeout(holdMs + 400);
}

/* ------------------------------------------------------------------ */
/* Test wrapper: manages the session and writes narration.json         */
/* ------------------------------------------------------------------ */

export const demoTest = base.extend<Record<never, never>>({
  page: async ({ page }, use, testInfo) => {
    await installDemoChrome(page);
    session = {
      page,
      testInfo,
      // Video capture starts at page creation, which is what just happened —
      // narration offsets are measured from here. They are only the fallback:
      // the postprocess script aligns audio to the on-screen sync markers and
      // uses these wall-clock offsets when marker detection fails.
      t0: Date.now(),
      events: [],
      pending: [],
      cursor: { x: 720, y: 450 },
      narrationEndsAt: 0,
    };
    try {
      await use(page);
    } finally {
      const s = session;
      session = null;
      if (s) {
        const tEnd = Date.now();
        // Any narration still being synthesized has to land before the
        // manifest is written, or the mux would miss those lines entirely.
        const results = await Promise.allSettled(s.pending);
        const failed = results.filter((r) => r.status === "rejected");
        for (const failure of failed) {
          console.error(`Narration synthesis failed: ${failure.reason}`);
        }
        const events = s.events.filter((e) => e.file);
        const cold = events.some((e) => e.estimated);
        fs.mkdirSync(testInfo.outputDir, { recursive: true });
        fs.writeFileSync(
          path.join(testInfo.outputDir, "narration.json"),
          JSON.stringify(
            {
              slug: testInfo.title
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, "-")
                .replace(/^-|-$/g, ""),
              provider: describeProvider(),
              t0: s.t0,
              tEnd,
              // Beats paced on an estimate rather than the real clip length:
              // this take may have overlapping narration, re-record it.
              cold,
              missing: s.events.length - events.length,
              events,
            },
            null,
            2,
          ),
        );
      }
    }
  },
});

export { expect } from "@playwright/test";
