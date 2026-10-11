/**
 * Narration synthesis for demo videos.
 *
 * Primary provider is ElevenLabs (set `ELEVENLABS_API_KEY` and `DEMO_VOICE_ID`); without a
 * key it falls back to the macOS `say` voice so demos still record — just with
 * a much flatter voiceover.
 *
 * Two things matter for demo quality and cost:
 *
 *  1. **Cache.** Audio is cached on disk by (provider, voice, model, speed,
 *     text), so re-recording a demo costs no extra ElevenLabs credits and no
 *     extra latency. Durations are cached alongside in `durations.json`.
 *  2. **Never block the recording on the network.** A synthesis request mid-beat
 *     would freeze the frame for a second or two. Generation is fired off in the
 *     background and awaited at teardown; the beat paces itself on the cached
 *     duration when there is one, and on a word-count estimate otherwise.
 *     That makes the FIRST run of a new narration line an imprecise take —
 *     `narration.json` is marked `cold` and the postprocess script says so.
 */

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

// Deliberately NOT under the Playwright outputDir (.demo-out): Playwright wipes
// that directory at the start of every run, which would re-bill every line and
// leave every take paced on estimates.
const CACHE_DIR = path.join(process.cwd(), ".demo-cache", "tts");
const DURATIONS_FILE = path.join(CACHE_DIR, "durations.json");

const API_KEY = process.env.ELEVENLABS_API_KEY?.trim();

// Voice selection belongs to the target project; no private narrator is pinned.
const VOICE_ID = process.env.DEMO_VOICE_ID?.trim();
if (API_KEY && !VOICE_ID) {
  throw new Error("Set DEMO_VOICE_ID when using ELEVENLABS_API_KEY.");
}
if (!API_KEY && process.platform !== "darwin") {
  throw new Error("Local narration requires macOS say; configure ELEVENLABS_API_KEY and DEMO_VOICE_ID on other platforms.");
}
// eleven_multilingual_v2 is the most consistent for narration; turbo/flash are
// cheaper and eleven_v3 more expressive but less predictable across takes.
const MODEL_ID = process.env.DEMO_TTS_MODEL ?? "eleven_multilingual_v2";
// Note: multilingual_v2 ignores `speed` — only the turbo/flash models honour it.
// Pace the video with beat `holdMs` instead of fighting the voice here.
const SPEED = Number(process.env.DEMO_TTS_SPEED ?? 1);

// Fallback (`say`) settings, also used when ELEVENLABS is unset.
const SAY_VOICE = process.env.DEMO_SAY_VOICE ?? "Samantha";
const SAY_RATE = Number(process.env.DEMO_SAY_RATE ?? 172);

export const provider = API_KEY ? "elevenlabs" : "say";

/** Measured pace of the default voice on multilingual_v2, ~190 wpm. */
const WORDS_PER_MS = 190 / 60 / 1000;

/**
 * Pacing estimate for a line that hasn't been synthesized yet. Deliberately
 * generous (+12%) — overrunning the beat makes two narration lines overlap in
 * the final mix, which is worse than a slightly long hold.
 */
export function estimateDurationMs(text: string): number {
  const words = text.trim().split(/\s+/).length;
  return Math.round((words / WORDS_PER_MS) * 1.12) + 400;
}

// Durations measured in this process. Several lines synthesize concurrently, so
// a plain read-modify-write of the file would drop entries whenever two writes
// interleave; the union of file + memory is always written back.
const measured: Record<string, number> = {};

function readDurations(): Record<string, number> {
  let onDisk: Record<string, number> = {};
  try {
    onDisk = JSON.parse(fs.readFileSync(DURATIONS_FILE, "utf8"));
  } catch {
    onDisk = {};
  }
  return { ...onDisk, ...measured };
}

function writeDuration(hash: string, durationMs: number): void {
  measured[hash] = durationMs;
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(DURATIONS_FILE, JSON.stringify(readDurations(), null, 2));
}

function measureDurationMs(file: string): number {
  const probed = execFileSync("ffprobe", [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "default=noprint_wrappers=1:nokey=1",
    file,
  ])
    .toString()
    .trim();
  const seconds = Number.parseFloat(probed);
  if (!Number.isFinite(seconds)) {
    throw new Error(`ffprobe could not read a duration for ${file}`);
  }
  return Math.round(seconds * 1000);
}

export interface NarrationClip {
  /** Absolute path to the audio file. */
  file: string;
  durationMs: number;
}

function cacheKey(text: string): { hash: string; file: string } {
  const signature =
    provider === "elevenlabs"
      ? `elevenlabs|${VOICE_ID}|${MODEL_ID}|${SPEED}|${text}`
      : `say|${SAY_VOICE}|${SAY_RATE}|${text}`;
  const hash = createHash("sha1").update(signature).digest("hex").slice(0, 16);
  const ext = provider === "elevenlabs" ? "mp3" : "aiff";
  return { hash, file: path.join(CACHE_DIR, `${hash}.${ext}`) };
}

/** Cached clip for this line, or null if it still has to be synthesized. */
export function lookup(text: string): NarrationClip | null {
  const { hash, file } = cacheKey(text);
  const known = readDurations()[hash];
  if (known && fs.existsSync(file)) return { file, durationMs: known };
  return null;
}

async function generateElevenLabs(text: string, file: string): Promise<void> {
  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: {
        "xi-api-key": API_KEY as string,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text,
        model_id: MODEL_ID,
        voice_settings: {
          // Middling stability keeps the read natural without the wandering
          // intonation that makes separate lines sound like different takes.
          stability: 0.45,
          similarity_boost: 0.8,
          use_speaker_boost: true,
          speed: SPEED,
        },
      }),
    },
  );
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `ElevenLabs ${response.status} for "${text.slice(0, 48)}…": ${detail.slice(0, 300)}`,
    );
  }
  const audio = Buffer.from(await response.arrayBuffer());
  // Write via a temp file so an interrupted run can't leave a truncated clip
  // in the cache to be trusted by the next run.
  const tmp = `${file}.part`;
  fs.writeFileSync(tmp, audio);
  fs.renameSync(tmp, file);
}

/**
 * Synthesize (or reuse) the audio for one narration line. Safe to call without
 * awaiting — the returned promise resolves once the file is on disk.
 */
export async function synthesize(text: string): Promise<NarrationClip> {
  const { hash, file } = cacheKey(text);
  const cached = lookup(text);
  if (cached) return cached;

  fs.mkdirSync(CACHE_DIR, { recursive: true });
  if (!fs.existsSync(file)) {
    if (provider === "elevenlabs") {
      await generateElevenLabs(text, file);
    } else {
      execFileSync("say", [
        "-v",
        SAY_VOICE,
        "-r",
        String(SAY_RATE),
        "-o",
        file,
        text,
      ]);
    }
  }
  const durationMs = measureDurationMs(file);
  writeDuration(hash, durationMs);
  return { file, durationMs };
}

export function describeProvider(): string {
  return provider === "elevenlabs"
    ? `ElevenLabs (voice ${VOICE_ID}, ${MODEL_ID}, speed ${SPEED})`
    : `macOS say (${SAY_VOICE} @ ${SAY_RATE} wpm) — configure ELEVENLABS_API_KEY and DEMO_VOICE_ID for cloud narration`;
}
