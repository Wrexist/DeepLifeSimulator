/**
 * Suggested YouVideo titles, per topic.
 *
 * Typing a title for every upload was a chore (tester, 2026-10-11), so the
 * composer offers a shuffle. The pick is deterministic in `seed` rather than a
 * `Math.random()` draw: the caller passes a press counter, every press lands on
 * a different title, and the repo's unseeded-randomness ratchet
 * (`__tests__/tooling/simulationDeterminismAudit.test.ts`) does not move.
 * Titles are flavour only - they do not affect views or earnings.
 */

const TEMPLATES: Record<string, readonly string[]> = {
  Tutorial: [
    'Beginner to Pro in One Video',
    'The Only Guide You Will Ever Need',
    '10 Tips Nobody Tells You',
    'How I Got Good (Step by Step)',
    'Stop Making These Mistakes',
    'The Fastest Way to Learn',
  ],
  Speedrun: [
    'New Personal Best?!',
    'Any% in Record Time',
    'This Skip Saved 30 Seconds',
    'I Tried a World Record Run',
    'One Mistake Away From Glory',
    'Speedrun Under 10 Minutes',
  ],
  'Boss Fight': [
    'No-Hit Run vs the Final Boss',
    'This Boss Broke Me',
    'Beating the Hardest Boss With No Upgrades',
    'Attempt #47 - Finally!',
    'The Boss Everyone Hates',
    'Level 1 vs the Secret Boss',
  ],
  'Lore Deep Dive': [
    'The Story You Completely Missed',
    'Every Secret Explained',
    'This Theory Changes Everything',
    'The Dark History Behind It All',
    'What the Ending REALLY Means',
    '3 Hours of Lore in 15 Minutes',
  ],
  'Top 10 List': [
    'Top 10 Moments of All Time',
    'Top 10 Hidden Secrets',
    'Ranking Every Weapon From Worst to Best',
    'Top 10 Things You Never Noticed',
    'Top 10 Hardest Challenges',
    'The 10 Best Upgrades, Ranked',
  ],
  Reaction: [
    'Reacting to My First Video',
    'I Was NOT Ready for This',
    'Reacting to Viewer Clips',
    'This Made Me Speechless',
    'Reacting to the New Trailer',
    'Watching Pros Play (Humbling)',
  ],
};

const FALLBACK = [
  'You Will Not Believe This',
  'My Best Video Yet',
  'I Tried Something New',
  'This Went Better Than Expected',
];

/**
 * A suggested title for `topic`. `seed` is a press counter; consecutive seeds
 * give consecutive (and so different) titles. `avoid` skips the current title
 * so a press always visibly changes the box.
 */
export function suggestVideoTitle(topic: string, seed: number, avoid?: string): string {
  const list = TEMPLATES[topic] ?? FALLBACK;
  const n = list.length;
  // Stride coprime with the list length, so presses walk the whole list in a
  // scrambled order instead of top to bottom.
  const start = Math.abs(Math.floor(seed) * 5) % n;
  for (let i = 0; i < n; i++) {
    const pick = list[(start + i) % n];
    if (pick !== avoid) return pick;
  }
  return list[0];
}

export const VIDEO_TITLE_TOPICS = Object.keys(TEMPLATES);
