---
name: infi-demo-recording
description: Record narrated demo videos of web app features with a visible gliding cursor, captions, voiceover, and narration-driven pacing. Use for walkthrough videos, feature showcases, or PR demos, typically one short video per user-facing flow.
---

# Recording narrated demo videos

Produce one short video per flow: visible cursor that glides to every target,
caption bar + voiceover narration, pacing tied to the narration length.
Output: `demo-artifacts/<slug>.mp4` (H.264 + AAC, plays in browser/Slack/GitHub).

Discover the app URL, port, auth, and any recorder the project already has.
Read project instructions and existing demo or e2e helpers first. If a recorder
is already there, use it and do not overwrite it. Otherwise install the kit
bundled in `assets/` by following
[references/recording-kit.md](references/recording-kit.md).

The bundled kit:

- `playwright/demos/kit.ts` — `demoTest`, `beat`, `title`, `glideClick`,
  `glideType`, `spotlight`. Each narration line is logged into
  `narration.json` next to the video, and a magenta sync marker is flashed
  at the instant the line starts — postprocess reads the flashes back from
  the pixels to place the audio exactly, then paints them out.
- `playwright/demos/tts.ts` — narration synthesis. ElevenLabs when
  `ELEVENLABS_API_KEY` is set, otherwise macOS `say`. Clips are cached in
  `.demo-cache/tts/` by (voice, model, text), so re-recording costs no
  credits and no latency.
- `playwright.demo.config.ts` — serial, video always on, 1440×900. It does
  not boot the app or log in. Point `DEMO_BASE_URL` at the real server and
  `DEMO_STORAGE_STATE` at the app's existing auth state when a flow needs it.
- `scripts/demo-postprocess.mjs` — webm → mp4, aligns the voiceover to the
  detected sync markers (wall-clock offsets only as fallback), erases the
  markers, normalizes to −16 LUFS, trims the silent lead-in, poster PNG,
  optional GIF (`DEMO_GIF=1`), copies traces.

Requires `ffmpeg`. The dev server must be running. Pass its real port via
`PORT`. Do not assume 3000.

### Voice

ElevenLabs uses `DEMO_VOICE_ID` on `eleven_multilingual_v2` when
`ELEVENLABS_API_KEY` is set. With no key, macOS `say` is used. Optional
presets live in `tts.ts` as `DEMO_VOICE=rachel|sarah|alice|brian|daniel|jessica`.
`multilingual_v2` **ignores** `speed` — pace the video with beat `holdMs`, not
by fighting the voice. No narrator id is built into this skill. Use a voice the
project configures, and do not print the key.

## Workflow — explore and perform are never merged

### 1. Plan the flows

List the user-visible flows the change added or altered (read the PR diff and
its e2e specs). One video per flow, 3–6 beats each, ≤ 90 s. For bug fixes,
show the broken behavior first if cheap to reproduce.

### 2. Explore (throwaway)

Find the real path to each flow: reuse selectors from `playwright/e2e/**`
utils where they exist; otherwise explore with agent-browser/playwright MCP.
Nothing here is recorded. Output: exact selectors, URLs, seed data.

### 3. Author (deterministic storyboard)

Write `playwright/demos/<slug>.demo.ts`:

```ts
import { demoTest, expect, beat, title, glideClick, spotlight } from "./kit";

demoTest("delete page", async ({ page }) => {
  // test title becomes the artifact slug
  await page.goto("/pages"); // reuse the app's own setup helpers
  await title({
    caption: "Danger zone — delete page",
    say: "Longer spoken intro…",
  });
  await beat({
    caption: "Short on-screen claim",
    say: "Spoken while the action happens — what we are about to do.",
    action: async ({ narrate }) => {
      await glideClick(page.getByRole("button", { name: "Delete page" }));
      await expect(page.getByRole("dialog")).toBeVisible(); // every beat asserts
      // Outcomes are narrated AFTER the assertion that made them visible:
      await narrate("Spoken only once the result is actually on screen.");
    },
  });
  await title({ caption: "Closing summary" });
});
```

Rules:

- Every beat's `action` ends in an `expect()` — a demo that can't fail is a
  screenshot, not proof.
- Captions state a **claim** ("The page is gone from the site structure"),
  not a mechanic ("click delete"). `say` may be longer than `caption`.
- **Never narrate an outcome in the line that starts the action.** The beat's
  `say` covers what is being done; the result gets its own `narrate()` call
  placed right after the `expect()` that proves it — so the words and the
  pixels agree. `narrate` returns when the line _starts_ (it first waits out
  the previous line); the beat's closing hold covers the tail.
- All _narratively important_ interactions go through `glideClick`/`glideType`
  so the cursor visibly travels. Setup/teardown can use plain utils.
- Pacing is automatic (each beat holds until its narration ends). Don't add
  `waitForTimeout` for pacing; only `holdMs` for extra breathing room.
- Deterministic: unique titled test pages (timestamp suffix), clean up
  created state at the end of the demo (e.g. delete the demo page), fixed
  viewport/locale/timezone come from the config.
- Keep total narration ≈ 60–90 s. Read the `say` lines aloud mentally;
  cut anything that doesn't change what the viewer would conclude.

### 4. Record, postprocess, verify

```bash
PORT=<dev-port> pnpm run demo          # pass 1 — warms the narration cache
PORT=<dev-port> pnpm run demo          # pass 2 — the take you ship
pnpm run demo:post                     # writes demo-artifacts/
```

Use the project's package manager and script names when they differ. The
bundled kit's scripts are `demo` and `demo:post`, as
[references/recording-kit.md](references/recording-kit.md) adds them. Record
the tested revision. If the tree is dirty, the receipt says so. A commit SHA
alone does not describe uncommitted changes.

**Record twice whenever narration text changed.** Synthesis runs in the
background so it never freezes a frame, which means the first take of a new
line paces on a word-count estimate and its narration can overrun into the
next beat. Pass 2 has exact durations from the cache. `demo:post` prints a
loud `⚠ … re-record this demo` for any take whose `narration.json` is
`cold: true` — never ship one of those.

Verify before handing off — do not skip:

- all demo tests passed (a failed beat means the claim is false, not "retry
  until green");
- `demo:post` printed `sync: marker` for every video — `sync: wall-clock`
  means marker detection failed and the narration placement is a guess;
  re-record rather than ship it;
- no `cold: true` warning from `demo:post`, and narration lines don't overlap
  (`ffmpeg -i <mp4> -af silencedetect=n=-40dB:d=0.5 -f null -` should show one
  gap per line);
- each mp4 exists, is 30–120 s, has an audio stream
  (`ffprobe -show_streams <mp4> | grep codec_type` shows video **and** audio);
- extract 3–4 frames (`ffmpeg -ss <t> -i <mp4> -frames:v 1 f.png`) and look
  at them: cursor visible, caption legible, no debug chrome;
- spot-check narration sync: a frame at an event's `offsetMs` should show
  that beat's caption.

### 5. Publish

Videos are gitignored — never commit them. Name the flows, say where the
files are (`open demo-artifacts/`), and attach them where the reviewer is.

**Linear** — upload and comment in one step:

```bash
linear issue comment add <issue> --body-file ./comment.md \
  --attach "$PWD/demo-artifacts/delete-page.mp4"   # absolute paths only
```

Skip Linear unless the project uses it and the user wants the video there.

Then **fix the body**: `--attach` appends the links on consecutive lines,
which is a single markdown paragraph, and Linear only renders a video player
for a link that is **alone in its own paragraph**. Multiple attachments
therefore arrive as dead-looking inline text links. Re-post the body with a
blank line around each link (uploads are reusable — no need to re-upload):

```bash
# resolve the full comment UUID, then rewrite the body
linear issue comment update <full-uuid> --body-file ./fixed.md
```

Verify by reading the body back — every `uploads.linear.app` link must match
`^\[.+\]\(https://uploads\.linear\.app/.+\)$` as a whole paragraph. The
upload itself is fine (`video/mp4`, `content-disposition: inline`); paragraph
structure is the only thing that decides whether it plays.

**GitHub** — the API cannot attach binaries to a comment. Either drag the
files into the PR by hand, or upload them elsewhere and link.

### 6. Post the receipt and label the PR

When the demos belong to an open PR, record that they exist — same pattern as
code review: a receipt comment carrying the recorded commit, plus a label.
Skip only when there is no PR yet; do it once the PR exists. A recording
request includes this receipt. It does not include uploading the video
anywhere else unless the user asks.

Receipts are **append-only** — post a new comment per recording run so
successive takes stay visible. Keep it small: what was demoed, against which
commit, and where to watch it.

```bash
gh pr comment <n> --body "$(cat <<'BODY'
## 🎬 Demo videos

**Recorded commit:** `<full-head-sha>`
**Uncommitted changes:** no
**Flows:** 2 — delete page · publish gate
**Narration:** ElevenLabs · sync: marker · no cold takes
**Watch:** <link to where the videos were attached or uploaded>

| Flow         | Shows                                        | Length |
| ------------ | -------------------------------------------- | ------ |
| Delete page  | Deleting a page leaves the editor            | 46s    |
| Publish gate | A live page cannot be deleted until it is off | 51s    |

<!-- infi-demo-recording sha=<full-head-sha> flows=2 sync=marker dirty=no -->
BODY
)"

gh pr edit <n> --add-label demo-recorded
```

Rules:

- `**Recorded commit:**` is the full SHA the videos were recorded against —
  never a branch name. A demo that cannot be tied to a commit proves nothing
  about the current head. When the tree was dirty, set
  `**Uncommitted changes:** yes` and `dirty=yes`.
- Apply **`demo-recorded`** on every receipt (idempotent). It means "a demo
  exists", not "the feature is approved".
- The label does not expire when new commits land. If the PR has moved on,
  say so and re-record rather than leaving a stale receipt as the newest one.
- Keep the trailer keys (`sha`, `flows`, `sync`, `dirty`) stable — they make
  the receipts searchable.
- State `sync: marker` / `no cold takes` only if `demo:post` actually said
  so. Never claim a flow that isn't in the videos.
- Videos live on Linear or as PR attachments — the receipt links to them, it
  does not host them. Never commit the files to satisfy this step.
- If `gh` fails (no PR, no auth), report it and hand the user the links —
  don't silently drop the receipt.

## Troubleshooting

- Voiceover out of sync → check `demo:post` said `sync: marker`. If it fell
  back to wall-clock, a sync-marker flash was lost (usually a narration cue
  fired during a navigation) — move the `narrate()` call after the
  navigation settles and re-record.
- Voice describes a result before it is visible → the outcome is in the
  beat's `say`; move it to a `narrate()` after the `expect()` (see Author
  rules).
- Narration lines overlapping → a cold take (see pass 1 / pass 2 above).
- Every line re-synthesized on every run → something is wiping
  `.demo-cache/tts/`. It must stay OUTSIDE `.demo-out`, which Playwright
  clears at the start of each run.
- No cursor in video → interactions bypassed `glideClick` (plain `.click()`
  doesn't move the overlay).
- Flaky beat → the flow needs a stronger wait (`expect(...).toBeVisible`)
  inside the action, not a longer hold.
- Video attached to Linear won't play → the link isn't alone in its own
  paragraph (see Publish). The asset is almost certainly fine; check the
  markdown, not the upload.
- `linear ... --attach` says "File not found" → it needs an absolute path.
- If a flow cannot be made deterministic, say so and ship the Playwright
  trace (`demo-artifacts/<slug>.trace.zip`) instead of a bad video.
