#!/usr/bin/env node
'use strict';
/**
 * UI complexity ratchet: the counts that made the app read as machine-made
 * may fall, must not rise.
 *
 *   npm run ui:ratchet
 *
 * Same mental model as coverage:ratchet / lint:ratchet / type-check:tests:
 * ratchet (deliberate - four gates, one idea). The 2026-09-01 UI audit
 * (tasks/ui-overhaul-blueprint.md) measured the presentation layer and found
 * the "AI-coded" impression was carried by a handful of countable habits:
 * decorative gradients (262 instances, one literally between two identical
 * colors), raw unscaled font sizes bypassing the type ladder, and 61% of all
 * font-weight declarations at 700+. Each phase of the overhaul lowers these;
 * this gate locks every win in and stops new code from quietly re-adding the
 * noise.
 *
 * Lower a ceiling in the commit that earns it. NEVER raise one to get a build
 * unstuck - that converts an honest debt into a false all-clear. If a metric
 * legitimately must grow (it happens - a new semantic gradient, say), the
 * change is arguing for itself in review, and the ceiling bump belongs in the
 * same commit with the reasoning in its message.
 */
const { readFileSync, readdirSync, statSync } = require('fs');
const { join, extname } = require('path');

const ROOT = join(__dirname, '..');

/** Where UI code lives. lib/ is logic-only (no JSX by layering rules). */
const UI_DIRS = ['app', 'components', 'src', 'contexts', 'hooks'];

/**
 * Ceilings, measured 2026-09-01 after overhaul phases 0-1 over app/,
 * components/, src/, contexts/ and hooks/ (a wider net than the audit's
 * headline numbers, which counted components/ + app/ only). Each entry is
 * { max, goal } - the runner tells you when a metric reaches its goal so the
 * ceiling can be lowered to lock the win in.
 */
const METRICS = {
  /**
   * JSX gradient instances (<Gradient .../<LinearGradient ...). The audit's
   * rule: gradients are for MEANING (a season, a state), never decoration.
   * Goal reflects the blueprint's "< 20, semantic only" target.
   */
  gradientElements: {
    max: 248,
    goal: 20,
    pattern: /<(?:LinearGradient|Gradient)[\s/>]/g,
  },
  /**
   * Raw numeric fontSize literals (fontSize: 14) - type that bypasses BOTH
   * fontScale() and the responsiveFontSize ladder, so it neither scales with
   * the device nor sits on the type scale.
   */
  rawFontSizes: {
    max: 368,
    goal: 0,
    pattern: /fontSize:\s*\d/g,
  },
  /**
   * Heavy font weights (700/800/900/bold). 61% of all weight declarations at
   * the time of the audit - when everything is bold, nothing is. The goal is
   * the blueprint's "< 25% of declarations", frozen here as an absolute count
   * against the audit-time total (~2,168 declarations).
   */
  heavyWeights: {
    max: 1381,
    goal: 540,
    pattern: /fontWeight:\s*'(?:700|800|900|bold)'/g,
  },
};

function walk(dir, out) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (['.tsx', '.ts'].includes(extname(name)) && !/\.(test|spec)\.tsx?$/.test(name)) {
      out.push(full);
    }
  }
}

function measure() {
  const files = [];
  for (const dir of UI_DIRS) {
    try {
      walk(join(ROOT, dir), files);
    } catch {
      /* missing dir - fine */
    }
  }
  const counts = Object.fromEntries(Object.keys(METRICS).map((k) => [k, 0]));
  for (const file of files) {
    const src = readFileSync(file, 'utf8');
    for (const [key, { pattern }] of Object.entries(METRICS)) {
      const m = src.match(pattern);
      if (m) counts[key] += m.length;
    }
  }
  return counts;
}

function main() {
  const counts = measure();
  let failed = false;
  for (const [key, { max, goal }] of Object.entries(METRICS)) {
    const n = counts[key];
    if (n > max) {
      failed = true;
      console.error(
        `[ui-ratchet] FAIL - ${key} rose to ${n} (ceiling ${max}). ` +
          'New UI code must not add to this count; see tasks/ui-overhaul-blueprint.md.'
      );
    } else if (n <= goal) {
      console.log(
        `[ui-ratchet] ${key}: ${n} - GOAL REACHED (${goal}). Consider lowering the ceiling to ${n}.`
      );
    } else if (n < max) {
      console.log(
        `[ui-ratchet] ${key}: ${n} (ceiling ${max}) - improved; lower the ceiling in the commit that earned it.`
      );
    } else {
      console.log(`[ui-ratchet] ${key}: ${n} (at ceiling ${max}).`);
    }
  }
  if (failed) process.exit(1);
  console.log('[ui-ratchet] OK');
}

main();
