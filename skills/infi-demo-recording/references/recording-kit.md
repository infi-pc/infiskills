# Install and use the bundled recording kit

The skill contains everything specific to recording. The target application
provides its own navigation, authentication, fixtures, and cleanup helpers.
If the project already has these files, keep them.

## Files and prerequisites

Copy these files from this skill's `assets/` into the matching target-project
paths, preserving existing files and adapting names or imports if they conflict:

- `playwright/demos/kit.ts`: cursor overlay, captions, title cards, beats,
  narration manifest and visual synchronization markers.
- `playwright/demos/tts.ts`: cached narration and measured durations.
- `playwright/demos/example.demo.ts`: standalone example to verify the kit.
  Replace it with real application flows after setup.
- `playwright.demo.config.ts`: serial recording configuration with no retries.
- `scripts/demo-postprocess.mjs`: H.264/AAC output, marker alignment and removal,
  loudness normalization, poster, optional GIF, and trace copying.

Requires Node, `@playwright/test`, a Chromium browser, `ffmpeg`, and `ffprobe`.
Use the project's package manager to add missing dependencies. Local speech
synthesis requires macOS `say`. Other platforms need the configured cloud
provider or a project-specific replacement.

Add scripts to the project's existing package manifest:

```json
{
  "demo": "playwright test --config=playwright.demo.config.ts",
  "demo:post": "node scripts/demo-postprocess.mjs"
}
```

Ignore `.demo-out/`, `.demo-cache/`, and `demo-artifacts/`. Keep the cache
outside `.demo-out/`, which Playwright clears on each run.

## Configure the target project

The configuration loads `.env.local` then `.env`. Existing environment values
win. It does not boot the app, seed state, or run an authentication dependency.
Reuse the app's own setup and await its readiness before recording.

- `DEMO_BASE_URL`: full app URL. Otherwise `http://localhost:${PORT}`, with
  port 3000 only as a fallback. Set the URL or port discovered during setup.
- `DEMO_STORAGE_STATE`: optional path to existing Playwright authentication
  state. Generate it through the app's normal auth setup first.
- `DEMO_TIMEZONE`: defaults to UTC. Change it for timezone-sensitive flows.
- `DEMO_BROWSER_CHANNEL`: optional installed browser channel, such as `chrome`.
  Otherwise use Playwright's bundled Chromium.
- `ELEVENLABS_API_KEY` and `DEMO_VOICE_ID`: both required for ElevenLabs.
  With no key, macOS `say` is used. No narrator id is embedded.
- `DEMO_TTS_MODEL`, `DEMO_TTS_SPEED`: default `eleven_multilingual_v2` and 1.
  Some models ignore speed. Rely on measured audio and beat holds for pacing.
- `DEMO_SAY_VOICE`, `DEMO_SAY_RATE`: default Samantha and 172 words per minute.

The recorder uses a 1440×900 viewport at device scale 1 so overlay coordinates
stay aligned with recorded pixels. Captions and the sync marker sit near the
top to avoid lower-edge clipping. Keep the marker geometry in `kit.ts` and
`demo-postprocess.mjs` in agreement when adapting the kit.

## Record and check the result

```bash
PORT=<actual-port> pnpm run demo   # warm new narration clips
PORT=<actual-port> pnpm run demo   # record with measured clip durations
pnpm run demo:post
```

Use the project's package manager when it is not pnpm. The test title becomes
the artifact slug. Postprocessing accepts optional source and output directory
arguments and `DEMO_GIF=1` for a GIF preview. Ship only passing takes reporting
`sync: marker`, no cold-cache warning, and no missing narration. A wall-clock
fallback is a diagnostic output, not a verified deliverable.
