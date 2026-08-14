/**
 * Audits the store metadata in `marketing/aso/metadata.mjs`.
 *
 * This exists because the failure mode is SILENT. Apple truncates an
 * over-long subtitle mid-word without telling anyone, and a term repeated
 * between the name and the keyword field is simply a slot thrown away — no
 * error, no warning, just a listing that ranks for less than it could.
 *
 * The previous metadata document carried its character counts as hand-written
 * annotations next to the copy. They were right when written and wrong within
 * one edit: its own subtitle spent eight characters re-indexing "life" and
 * "sim", both already in the app name, under a heading that told the reader
 * never to do that.
 *
 * Run: node scripts/check-aso.mjs        (audit)
 *      node scripts/check-aso.mjs --emit (audit, then print paste-ready copy)
 */
import { APPLE, CLAIMS, EXCLUSIONS, PLAY } from '../marketing/aso/metadata.mjs';

const LIMITS = {
  appleName: 30,
  appleSubtitle: 30,
  appleKeywords: 100,
  applePromo: 170,
  appleDescription: 4000,
  playTitle: 30,
  playShort: 80,
  playLong: 4000,
  iapName: 30,
};

/** Words Apple will not index or that waste characters. */
const WASTED = new Set([
  'app', 'apps', 'game', 'games', 'free', 'best', 'top', 'new', 'the', 'a', 'an',
  'and', 'or', 'for', 'with', 'your', 'my', 'to', 'of', 'in', 'on', 'simulation',
]);

/** Competitor marks that are a review risk in any indexed field. */
const TRADEMARKS = ['bitlife', 'sims', 'gta', 'roblox', 'minecraft', 'torn', 'instlife'];

const problems = [];
const warnings = [];
const notes = [];

const fail = (m) => problems.push(m);
const warn = (m) => warnings.push(m);
const note = (m) => notes.push(m);

/** Apple counts characters, so use the string length users' clients see. */
const len = (s) => [...s].length;

function checkLimit(label, value, limit) {
  const n = len(value);
  if (n > limit) fail(`${label} is ${n}/${limit} — OVER by ${n - limit}. Apple truncates silently.`);
  else note(`${label}: ${n}/${limit}`);
  return n;
}

/** Indexable word stems, lowercased, punctuation stripped. */
function terms(text) {
  return [...new Set(
    text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean)
  )];
}

/** Apple stems plurals, so `career` and `careers` are the same slot. */
const stem = (w) => w.replace(/(ies)$/, 'y').replace(/(es|s)$/, '');

// ── Character limits ───────────────────────────────────────────────────────
const keywordField = APPLE.keywords.join(',');
checkLimit('Apple name', APPLE.name, LIMITS.appleName);
checkLimit('Apple subtitle', APPLE.subtitle, LIMITS.appleSubtitle);
const kwLen = checkLimit('Apple keywords', keywordField, LIMITS.appleKeywords);
checkLimit('Apple promotional text', APPLE.promotionalText, LIMITS.applePromo);
checkLimit('Apple description', APPLE.description, LIMITS.appleDescription);
checkLimit('Play title', PLAY.title, LIMITS.playTitle);
checkLimit('Play short description', PLAY.shortDescription, LIMITS.playShort);
checkLimit('Play long description', PLAY.longDescription, LIMITS.playLong);

// ── Keyword field mechanics ────────────────────────────────────────────────
if (/,\s/.test(keywordField)) fail('Keyword field has a space after a comma. Each one costs a character and buys nothing.');
if (/\s/.test(keywordField)) warn('Keyword field contains a space. Multi-word phrases are unnecessary — Apple matches across fields.');
if (kwLen < LIMITS.appleKeywords - 12) {
  warn(`Keyword field only uses ${kwLen}/100. ${100 - kwLen} characters are being left on the table.`);
}
const dupes = APPLE.keywords.filter((k, i) => APPLE.keywords.findIndex((o) => stem(o) === stem(k)) !== i);
if (dupes.length) fail(`Keyword field repeats itself: ${dupes.join(', ')}`);

// ── Cross-field duplication: the expensive, invisible mistake ──────────────
const nameTerms = terms(APPLE.name).map(stem);
const subTerms = terms(APPLE.subtitle).map(stem);
const kwTerms = APPLE.keywords.map(stem);

const overlap = (a, b, labelA, labelB) => {
  const hits = a.filter((t) => b.includes(t) && !WASTED.has(t));
  if (hits.length) {
    fail(`${labelA} and ${labelB} both index: ${hits.join(', ')}. Apple matches ACROSS fields, so the second copy is a wasted slot.`);
  }
};
overlap(nameTerms, subTerms, 'Name', 'subtitle');
overlap(nameTerms, kwTerms, 'Name', 'keyword field');
overlap(subTerms, kwTerms, 'Subtitle', 'keyword field');

// ── Wasted and risky terms ─────────────────────────────────────────────────
for (const [label, list] of [['name', nameTerms], ['subtitle', subTerms], ['keyword field', kwTerms]]) {
  const junk = list.filter((t) => WASTED.has(t));
  if (junk.length) warn(`${label} contains terms Apple does not index or already indexes: ${junk.join(', ')}`);
}
const indexed = `${APPLE.name} ${APPLE.subtitle} ${keywordField}`.toLowerCase();
for (const mark of TRADEMARKS) {
  if (indexed.includes(mark)) fail(`"${mark}" appears in an indexed field — competitor trademark, App Store Review 5.2.5 risk.`);
}

// ── Conversion checks the limits do not catch ──────────────────────────────
const firstLines = APPLE.description.split('\n').slice(0, 3).join(' ').trim();
if (len(firstLines) > 300) {
  warn(`The first three description lines run ${len(firstLines)} chars. Only about 170 show before "more" — front-load the hook.`);
}
if (!/^[A-Z]/.test(APPLE.description.trim())) warn('Description does not open on a capital letter.');
for (const field of ['description', 'promotionalText']) {
  if (/\b(lorem|TODO|TBD|XXX)\b/i.test(APPLE[field])) fail(`Apple ${field} still contains placeholder text.`);
}

// Google Play DOES index the long description, unlike Apple. Check the target
// terms actually appear in it.
const playText = `${PLAY.title} ${PLAY.shortDescription} ${PLAY.longDescription}`.toLowerCase();
const missingOnPlay = [...nameTerms, ...subTerms, ...kwTerms]
  .filter((t) => !WASTED.has(t))
  .filter((t) => !playText.includes(t.slice(0, Math.max(4, t.length - 2))));
if (missingOnPlay.length) {
  warn(`Play long description never mentions: ${[...new Set(missingOnPlay)].join(', ')}. Unlike Apple, Play indexes this field.`);
}

// ── Claims that are not true of this build ─────────────────────────────────
// Both of these were in the previous copy. Metadata that oversells is a 2.3.1
// review problem, and the expensive part comes after it passes: a player who
// installed on "no forced ads" meets one and leaves a one-star review, and
// rating feeds the ranking this file exists to raise.
const UNTRUE = [
  { pattern: /no (forced )?ads\b/i, why: 'lib/ads/interstitial.ts shows full-screen interstitials at in-game year boundaries. Capped, but unavoidable.' },
  { pattern: /pay[- ]to[- ]win/i, why: 'utils/iapConfig.ts sells permanent multipliers for money (Work Pay Boost +50% earnings, Unlock All Perks); DeepLife+ adds +25% career income.' },
  { pattern: /everything can be earned/i, why: 'The $1.99 perks are real-money only — they are not in the gem shop.' },
  { pattern: /(about|roughly|just) an hour/i, why: 'A life is one tap per in-game week across ~60 years. Story mode, which batched weeks, was removed.' },
];
for (const field of ['description', 'promotionalText']) {
  for (const u of UNTRUE) {
    if (u.pattern.test(APPLE[field])) fail(`Apple ${field} makes a claim this build does not support (${u.pattern}). ${u.why}`);
  }
}
for (const u of UNTRUE) {
  if (u.pattern.test(PLAY.longDescription)) fail(`Play long description makes an unsupported claim (${u.pattern}). ${u.why}`);
}

// ── Localised keyword fields ───────────────────────────────────────────────
// The US storefront indexes es-MX metadata alongside en-US, so this is a
// second keyword field rather than a translation chore.
for (const [locale, loc] of Object.entries(APPLE.localized ?? {})) {
  const field = loc.keywords.join(',');
  checkLimit(`${locale} keywords`, field, LIMITS.appleKeywords);
  checkLimit(`${locale} subtitle`, loc.subtitle, LIMITS.appleSubtitle);
  if (/,\s/.test(field)) fail(`${locale} keyword field has a space after a comma.`);
  const locDupes = loc.keywords.filter((k, i) => loc.keywords.findIndex((o) => stem(o) === stem(k)) !== i);
  if (locDupes.length) fail(`${locale} keyword field repeats itself: ${locDupes.join(', ')}`);
  // Overlap with its OWN subtitle wastes a slot the same way en-US does.
  overlap(terms(loc.subtitle).map(stem), loc.keywords.map(stem), `${locale} subtitle`, `${locale} keyword field`);
  if (locale === 'es-MX') {
    const sameAsEnUs = loc.keywords.filter((k) => kwTerms.includes(stem(k)));
    if (sameAsEnUs.length) {
      warn(`es-MX repeats en-US terms (${sameAsEnUs.join(', ')}). The point of this field is terms en-US could not fit.`);
    }
  }
  // A keyword field in a language the rest of the listing does not speak is a
  // bad experience for everyone it reaches. Ship the whole localisation or none.
  if (locale !== 'en-GB') {
    if (!loc.description) fail(`${locale} has keywords but no translated description — that is a keyword grab, not a localisation.`);
    else checkLimit(`${locale} description`, loc.description, LIMITS.appleDescription);
    if (loc.promotionalText) checkLimit(`${locale} promotional text`, loc.promotionalText, LIMITS.applePromo);
  }
  if (locale === 'en-GB' && field === keywordField) {
    note('en-GB keywords match en-US exactly — those storefronts fall back to en-US anyway, so this adds nothing. Harmless, and worth differing only if the markets do.');
  }
}

// ── IAP display names ──────────────────────────────────────────────────────
for (const r of APPLE.iapRenames) {
  const n = len(r.to);
  if (n > LIMITS.iapName) fail(`IAP rename "${r.to}" is ${n}/${LIMITS.iapName} chars.`);
}

// ── Report ─────────────────────────────────────────────────────────────────
const line = (c, m) => console.log(`${c} ${m}`);
console.log('\nASO audit — marketing/aso/metadata.mjs\n' + '─'.repeat(60));
notes.forEach((m) => line('  ·', m));
console.log('');
console.log(`  Indexed term set (${new Set([...nameTerms, ...subTerms, ...kwTerms].filter((t) => !WASTED.has(t))).size} unique):`);
console.log('    ' + [...new Set([...nameTerms, ...subTerms, ...kwTerms])].filter((t) => !WASTED.has(t)).join(' · '));
console.log('');
warnings.forEach((m) => line('  ⚠', m));
problems.forEach((m) => line('  ✗', m));
if (!problems.length && !warnings.length) line('  ✓', 'All checks pass.');
else if (!problems.length) line('  ✓', 'No blocking problems.');
console.log('');
console.log(`  Deliberately excluded: ${EXCLUSIONS.map((e) => e.term).join(', ')}`);
console.log('');
console.log('  Claims made, and what backs each one:');
for (const c of CLAIMS) console.log(`    · ${c.claim}\n        ${c.evidence}`);
console.log('');
// Every claim should be traceable to something in the build. A claim with no
// evidence line is the shape the two removed ones had.
const unbacked = CLAIMS.filter((c) => !c.evidence || c.evidence.length < 20);
if (unbacked.length) fail(`Claims with no real evidence: ${unbacked.map((c) => c.claim).join('; ')}`);
if (unbacked.length) { unbacked.forEach((c) => console.log(`  ✗ unbacked claim: ${c.claim}`)); process.exit(1); }

if (process.argv.includes('--emit')) {
  console.log('─'.repeat(60) + '\nPASTE-READY\n' + '─'.repeat(60));
  console.log(`\n[Apple · Name ${len(APPLE.name)}/30]\n${APPLE.name}`);
  console.log(`\n[Apple · Subtitle ${len(APPLE.subtitle)}/30]\n${APPLE.subtitle}`);
  console.log(`\n[Apple · Keywords ${kwLen}/100]\n${keywordField}`);
  console.log(`\n[Apple · Promotional text ${len(APPLE.promotionalText)}/170]\n${APPLE.promotionalText}`);
  console.log(`\n[Apple · Description ${len(APPLE.description)}/4000]\n${APPLE.description}`);
  console.log(`\n[Play · Title ${len(PLAY.title)}/30]\n${PLAY.title}`);
  console.log(`\n[Play · Short ${len(PLAY.shortDescription)}/80]\n${PLAY.shortDescription}`);
  console.log(`\n[Play · Long ${len(PLAY.longDescription)}/4000]\n${PLAY.longDescription}`);
}

process.exit(problems.length ? 1 : 0);
