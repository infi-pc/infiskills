#!/usr/bin/env node
/**
 * Turn raw Playwright demo recordings (.demo-out/**\/*.webm) into shippable
 * narrated videos in demo-artifacts/:
 *   <slug>.mp4   — H.264 + AAC voiceover, plays everywhere (browser, Slack)
 *   <slug>.png   — poster frame
 *   <slug>.gif   — optional inline preview (DEMO_GIF=1)
 *
 * Voiceover: playwright/demos/kit.ts writes a narration.json next to each
 * video with one entry per spoken line, and flashes a magenta sync marker in
 * the top-left corner at the instant each line starts. This script finds
 * those flashes in the pixels, places each audio clip at its true video
 * timestamp (wall-clock offsets drift against Playwright's screencast),
 * erases the markers with a delogo filter, and mixes all lines into one AAC
 * track. If detection fails (marker count ≠ line count), it falls back to
 * the wall-clock offsets from the manifest and says so.
 *
 * Usage: node scripts/demo-postprocess.mjs [src=.demo-out] [out=demo-artifacts]
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const SRC = process.argv[2] ?? ".demo-out";
const OUT = process.argv[3] ?? "demo-artifacts";

function run(cmd, args) {
  return execFileSync(cmd, args, { stdio: ["ignore", "pipe", "pipe"] })
    .toString()
    .trim();
}

function ffmpeg(args) {
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", ...args], {
    stdio: "inherit",
  });
}

/**
 * Narration sync marker — must match the overlay element in
 * playwright/demos/kit.ts (12×12 px magenta square, 2 px from the
 * top-left corner).
 */
const MARKER = { size: 12, left: 2, top: 2 };

/**
 * Timestamps (ms, video timeline) of the sync-marker flashes. The marker is
 * pure magenta — both chroma planes near their ceiling — which no real UI
 * content sustains across the whole patch, so a plain threshold on the
 * cropped region's U/V averages is reliable.
 */
function detectMarkerTimesMs(file) {
  const crop = `crop=${MARKER.size}:${MARKER.size}:${MARKER.left}:${MARKER.top}`;
  const out = run("ffprobe", [
    "-v",
    "error",
    "-f",
    "lavfi",
    "-i",
    `movie='${file.replace(/'/g, "\\'")}',${crop},signalstats`,
    "-show_entries",
    "frame=pts_time:frame_tags=lavfi.signalstats.UAVG,lavfi.signalstats.VAVG",
    "-of",
    "json",
  ]);
  const frames = JSON.parse(out).frames ?? [];
  const times = [];
  let inFlash = false;
  for (const frame of frames) {
    const u = Number(frame.tags?.["lavfi.signalstats.UAVG"]);
    const v = Number(frame.tags?.["lavfi.signalstats.VAVG"]);
    const on = u > 170 && v > 170;
    if (on && !inFlash) times.push(Math.round(Number(frame.pts_time) * 1000));
    inFlash = on;
  }
  return times;
}

function durationMs(file) {
  const out = run("ffprobe", [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "default=noprint_wrappers=1:nokey=1",
    file,
  ]);
  const s = Number.parseFloat(out);
  if (!Number.isFinite(s)) throw new Error(`ffprobe: no duration for ${file}`);
  return Math.round(s * 1000);
}

/** Find every directory under `dir` that contains a recorded video. */
function findVideoDirs(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) findVideoDirs(p, acc);
    else if (entry.isFile() && entry.name.endsWith(".webm")) {
      acc.push(dir);
      break;
    }
  }
  return acc;
}

const dirs = findVideoDirs(SRC);
if (dirs.length === 0) {
  console.error(`No .webm recordings found under ${SRC}. Run the demos first.`);
  process.exit(1);
}

fs.mkdirSync(OUT, { recursive: true });

for (const dir of dirs) {
  const webm = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".webm"))
    .map((f) => path.join(dir, f))
    // Playwright writes one video per page; take the newest if several exist.
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0];

  const manifestPath = path.join(dir, "narration.json");
  const manifest = fs.existsSync(manifestPath)
    ? JSON.parse(fs.readFileSync(manifestPath, "utf8"))
    : null;

  // The manifest carries the test title as the slug. Falling back to the
  // Playwright result-directory name means stripping its decorations:
  // "demos-<file>.demo.ts-<test title>-chromium-demo".
  const slug =
    manifest?.slug ||
    path
      .basename(dir)
      .replace(/-chromium.*$/, "")
      .replace(/^demos-/, "")
      .replace(/^.*\.demo\.ts-/, "");

  const finalMp4 = path.join(OUT, `${slug}.mp4`);
  const tmpMp4 = path.join(OUT, `.${slug}.video.mp4`);

  // 1. Encode video: webm (vp8) → H.264 mp4. Also normalizes fps.
  ffmpeg([
    "-i",
    webm,
    "-vf",
    "fps=30,scale=1440:-2:flags=lanczos",
    "-c:v",
    "libx264",
    "-preset",
    "medium",
    "-crf",
    "21",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    "-an",
    tmpMp4,
  ]);

  // 2. Mux the voiceover, aligning narration to the video timeline.
  const events = manifest?.events ?? [];
  let sync = "no narration";
  if (events.length > 0) {
    // Preferred alignment: the sync markers kit.ts flashed at each line's
    // start, read back from the pixels — exact per line and immune to
    // screencast drift. Wall-clock offsets are only the fallback: the video
    // timeline stretches against the wall clock whenever the screencast
    // stalls (compiles, navigations), so a single inferred lead-in shift can
    // be off by up to seconds late in a take.
    const markers = detectMarkerTimesMs(tmpMp4);
    const markersOk = markers.length === events.length;
    let delays;
    if (markersOk) {
      sync = "marker";
      delays = markers;
    } else {
      sync = "wall-clock";
      console.warn(
        `  ⚠ ${slug}: expected ${events.length} sync markers, detected ` +
          `${markers.length} — falling back to wall-clock alignment; ` +
          `narration may drift, consider re-recording.`,
      );
      const videoMs = durationMs(tmpMp4);
      const sessionMs = manifest.tEnd - manifest.t0;
      // The video starts slightly before the demo session (page open → test
      // body) and ends slightly after (test end → context close, ~200ms).
      // Whatever length is unaccounted for is that lead-in; shift all
      // narration by it.
      const leadInMs = videoMs - sessionMs - 200;
      if (leadInMs < 0) {
        console.warn(
          `  ⚠ ${slug}: video is ${-leadInMs}ms shorter than the demo ` +
            `session — the screencast dropped time, offsets will be off.`,
        );
      }
      delays = events.map((e) =>
        Math.max(0, Math.round(Math.max(0, leadInMs) + e.offsetMs)),
      );
    }

    // Auto-trim silent dead time before the first narration (dev-server page
    // compile, app load…) so the video opens ~1.2s before the voiceover.
    const trimMs = Math.max(0, Math.min(...delays) - 1200);
    // Erase the marker flashes: delogo interpolates the patch from its
    // surroundings, enabled from a frame before each flash to past its
    // 180ms lifetime.
    
    const delogo = markersOk
      ? markers.map((m) => {
          const from = ((m - 80) / 1000).toFixed(3);
          const to = ((m + 320) / 1000).toFixed(3);
          return (
            `delogo=x=${MARKER.left - 1}:y=${MARKER.top - 1}:` +
            `w=${MARKER.size + 2}:h=${MARKER.size + 2}:enable='between(t,${from},${to})'`
          );
        })
      : [];

    let videoIn = tmpMp4;
    if (trimMs > 300 || delogo.length > 0) {
      const cleaned = path.join(OUT, `.${slug}.clean.mp4`);
      const args = ["-i", tmpMp4];
      // -ss after -i: frame-accurate output seek (re-encodes, which is fine —
      // same encode settings as step 1). Seeking drops frames *after* the
      // filter graph ran, so the delogo windows are in the un-trimmed
      // timeline on purpose.
      if (trimMs > 300) args.push("-ss", (trimMs / 1000).toFixed(3));
      if (delogo.length > 0) args.push("-vf", delogo.join(","));
      args.push(
        "-c:v",
        "libx264",
        "-preset",
        "medium",
        "-crf",
        "21",
        "-pix_fmt",
        "yuv420p",
        "-movflags",
        "+faststart",
        "-an",
        cleaned,
      );
      ffmpeg(args);
      if (trimMs > 300) delays = delays.map((d) => d - trimMs);
      videoIn = cleaned;
    }

    const inputs = [];
    const filters = [];
    const mixIns = [];
    events.forEach((e, i) => {
      inputs.push("-i", e.file);
      filters.push(
        `[${i + 1}:a]aformat=sample_rates=44100:channel_layouts=stereo,` +
          `adelay=${delays[i]}:all=1[a${i}]`,
      );
      mixIns.push(`[a${i}]`);
    });
    // Mix the lines onto one track, then normalize to the -16 LUFS the web
    // expects — raw TTS output lands around -26 dB, quiet enough that a
    // reviewer has to reach for the volume.
    filters.push(
      `${mixIns.join("")}amix=inputs=${events.length}:normalize=0:dropout_transition=0[amixed]`,
      `[amixed]loudnorm=I=-16:TP=-1.5:LRA=11[aout]`,
    );

    ffmpeg([
      "-i",
      videoIn,
      ...inputs,
      "-filter_complex",
      filters.join(";"),
      "-map",
      "0:v",
      "-map",
      "[aout]",
      "-c:v",
      "copy",
      "-c:a",
      "aac",
      "-b:a",
      "160k",
      "-movflags",
      "+faststart",
      finalMp4,
    ]);
    fs.rmSync(tmpMp4);
    if (videoIn !== tmpMp4) fs.rmSync(videoIn);
  } else {
    fs.renameSync(tmpMp4, finalMp4);
  }

  // 3. Poster frame.
  ffmpeg([
    "-ss",
    "1",
    "-i",
    finalMp4,
    "-frames:v",
    "1",
    path.join(OUT, `${slug}.png`),
  ]);

  // 4. Optional GIF preview for inline PR embedding.
  if (process.env.DEMO_GIF === "1") {
    const palette = path.join(OUT, ".palette.png");
    ffmpeg([
      "-i",
      finalMp4,
      "-vf",
      "fps=10,scale=880:-1:flags=lanczos,palettegen=stats_mode=diff",
      palette,
    ]);
    ffmpeg([
      "-i",
      finalMp4,
      "-i",
      palette,
      "-lavfi",
      "fps=10,scale=880:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=3",
      path.join(OUT, `${slug}.gif`),
    ]);
    fs.rmSync(palette);
  }

  // 5. Keep the trace for reviewers who want to interrogate rather than watch.
  const trace = path.join(dir, "trace.zip");
  if (fs.existsSync(trace)) {
    fs.copyFileSync(trace, path.join(OUT, `${slug}.trace.zip`));
  }

  const size = (fs.statSync(finalMp4).size / 1024 / 1024).toFixed(1);
  console.log(
    `→ ${finalMp4}  (${size} MB, ${(durationMs(finalMp4) / 1000).toFixed(1)}s, ` +
      `${events.length} narration lines, sync: ${sync}, ` +
      `${manifest?.provider ?? "no narration"})`,
  );
  if (manifest?.cold) {
    console.warn(
      `  ⚠ ${slug}: some narration was synthesized during this take, so those ` +
        `beats were paced on an estimate and may overlap. The clips are cached ` +
        `now — re-record this demo for a clean take.`,
    );
  }
  if (manifest?.missing) {
    console.warn(
      `  ⚠ ${slug}: ${manifest.missing} narration line(s) failed to synthesize ` +
        `and are silent in this video.`,
    );
  }
}
