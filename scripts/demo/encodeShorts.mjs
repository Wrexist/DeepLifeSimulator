#!/usr/bin/env node
/**
 * Turn the Playwright capture into YouTube-spec Shorts.
 *
 * Playwright starts recording when the page is created, so each raw .webm
 * carries the whole boot sequence and the setup navigation in front of the
 * actual Short. Each spec writes a sidecar JSON recording when its first real
 * frame happened relative to page creation; this trims to that window and
 * encodes to the published spec: 2160x3840, 30fps, H.264 High, yuv420p,
 * faststart.
 *
 * yuv420p is not optional — 4:2:0 is what every player and the YouTube
 * transcoder expect, and Chromium's VP8 output is 4:2:0 anyway, so anything
 * else just risks a file that previews black on some devices.
 *
 * Run: npm run shorts:encode  (or npm run shorts, which captures first)
 */

import { readdirSync, readFileSync, existsSync, statSync, mkdirSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import ffmpegPath from 'ffmpeg-static';
import ffprobeStatic from 'ffprobe-static';

const HERE = dirname(fileURLToPath(import.meta.url));
const SHORTS_DIR = resolve(HERE, '../../marketing/videos/shorts');

/**
 * Trim a beat late rather than early. A few black frames at the head is the
 * worst possible opening for a Short — the first second decides distribution —
 * and the cover means anything before the mark is flat black anyway.
 */
const HEAD_SAFETY_SEC = 0.26;

/** Drop the tail a little early so the closing cover never shows as a black frame. */
const TAIL_SAFETY_SEC = 0.35;

/** Output geometry. 9:16; 2160x3840 is the max YouTube accepts for Shorts. */
const TARGET = { w: 2160, h: 3840 };

/**
 * Locate the clip inside the raw recording.
 *
 * The spec holds a pure-black cover over boot and setup, drops it for the
 * Short, then puts it back. So the clip is the gap between the first and last
 * black runs. This is measured in VIDEO time, which is the whole point:
 * Playwright records variable-rate and drops frames while the app is booting,
 * so wall-clock timestamps from the spec can be seconds out.
 *
 * Returns null when the markers aren't found, so the caller can fall back to
 * the wall-clock numbers rather than emitting a mis-trimmed file.
 */
function findMarkers(src) {
  // blackdetect reports on stderr, not stdout — ffmpeg exits 0 here, so the
  // result has to be read from the stderr pipe rather than a thrown error.
  const res = spawnSync(
    ffmpegPath,
    ['-hide_banner', '-i', src, '-vf', 'blackdetect=d=0.35:pix_th=0.04', '-an', '-f', 'null', '-'],
    { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }
  );
  const out = `${res.stdout ?? ''}${res.stderr ?? ''}`;

  const runs = [...out.matchAll(/black_start:([\d.]+)\s+black_end:([\d.]+)/g)].map((m) => ({
    start: parseFloat(m[1]),
    end: parseFloat(m[2]),
  }));
  if (runs.length < 2) return null;

  const head = runs[0];
  const tail = runs[runs.length - 1];
  // The head run must actually be the leader, not a dark beat mid-clip.
  if (head.start > 2) return null;
  if (tail.start <= head.end) return null;
  return { start: head.end, end: tail.start };
}

/** Newest .webm under a Playwright test output directory. */
function findVideo(dir) {
  if (!existsSync(dir)) return null;
  const hits = [];
  const walk = (d) => {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, entry.name);
      if (entry.isDirectory()) walk(p);
      else if (entry.name.endsWith('.webm')) hits.push({ p, m: statSync(p).mtimeMs });
    }
  };
  walk(dir);
  if (!hits.length) return null;
  return hits.sort((a, b) => b.m - a.m)[0].p;
}

function main() {
  if (!existsSync(SHORTS_DIR)) {
    console.error(`No capture output at ${SHORTS_DIR}. Run \`npm run shorts:capture\` first.`);
    process.exit(1);
  }

  const sidecars = readdirSync(SHORTS_DIR).filter((f) => f.endsWith('.json'));
  if (!sidecars.length) {
    console.error(`No sidecars in ${SHORTS_DIR}. Run \`npm run shorts:capture\` first.`);
    process.exit(1);
  }

  mkdirSync(SHORTS_DIR, { recursive: true });
  let made = 0;

  for (const file of sidecars.sort()) {
    const meta = JSON.parse(readFileSync(join(SHORTS_DIR, file), 'utf8'));
    const src = findVideo(meta.video);
    if (!src) {
      console.error(`  ${meta.id}: no .webm under ${meta.video} — skipped`);
      continue;
    }

    const out = join(SHORTS_DIR, `${meta.id}.mp4`);

    const marks = findMarkers(src);
    if (!marks) {
      console.warn(
        `  ${meta.id}: black markers not found — falling back to wall-clock trim, CHECK THE RESULT`
      );
    }
    const start = marks
      ? marks.start + HEAD_SAFETY_SEC
      : Math.max(0, meta.startSec + HEAD_SAFETY_SEC);
    // Source seconds we actually want, before any speed change.
    const srcSpan = marks
      ? Math.max(1, marks.end - marks.start - HEAD_SAFETY_SEC - TAIL_SAFETY_SEC)
      : Math.max(1, meta.durSec - HEAD_SAFETY_SEC - TAIL_SAFETY_SEC);

    // No speed correction here on purpose. Chromium's screencast timeline runs
    // a few percent slow against the wall clock, and a `setpts` rescale does
    // fix that — but `-t` is an output-side limit, so once timestamps are
    // compressed the two stop agreeing about where the clip ends and the
    // closing black cover gets dragged back into the file. The artefact it
    // corrects is ~8% on mostly-static screens, i.e. invisible; a black tail is
    // not. Length is controlled in the capture spec instead.
    // Keep the 4K capture at 4K. YouTube serves Shorts at 1080p either way, but
    // it gives a >1080p upload a much better transcode — and this app is
    // wall-to-wall dark gradients, which are the first thing to band when the
    // transcoder is mean. Downscaling here would throw that advantage away.
    const filters = [`scale=${TARGET.w}:${TARGET.h}:flags=lanczos`, 'fps=30', 'format=yuv420p'];
    const dur = srcSpan;

    // -ss AFTER -i is the accurate (decode-and-discard) seek. These clips are
    // seconds long, so the cost is irrelevant and frame-exact trimming matters.
    execFileSync(
      ffmpegPath,
      [
        '-hide_banner', '-loglevel', 'error', '-y',
        '-i', src,
        '-ss', start.toFixed(3),
        '-t', dur.toFixed(3),
        '-an',
        '-vf', filters.join(','),
        '-c:v', 'libx264', '-profile:v', 'high', '-level', '5.2',
        '-preset', 'slow', '-crf', '15',
        // Dark gradients band before they look soft, so hold a bitrate floor
        // rather than letting CRF alone decide on very flat frames.
        '-maxrate', '40M', '-bufsize', '80M',
        '-x264-params', 'aq-mode=3:aq-strength=1.1',
        '-movflags', '+faststart',
        out,
      ],
      { stdio: 'inherit' }
    );

    const probe = JSON.parse(
      execFileSync(
        ffprobeStatic.path,
        ['-v', 'error', '-print_format', 'json', '-show_streams', out],
        { encoding: 'utf8' }
      ).toString()
    ).streams?.[0] ?? {};

    const mb = (statSync(out).size / 1024 / 1024).toFixed(1);
    console.log(
      `  ${meta.id.padEnd(20)} ${probe.width}x${probe.height}  ${Number(probe.duration ?? dur).toFixed(1)}s  ${mb}MB  "${meta.title}"`
    );
    made++;
  }

  console.log(`\n${made} Short(s) -> ${SHORTS_DIR}`);
}

main();
