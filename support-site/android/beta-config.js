/**
 * Deep Life Simulator — Beta Hub public configuration.
 *
 * Everything in this file is PUBLIC. It ships in the page source, so nothing
 * secret may ever live here — the admin token is typed in at the admin page and
 * held in that tab's sessionStorage, never written down in the repo.
 *
 * Operational settings (Play Store URLs, target tester count, beta vs launch
 * mode) are NOT here on purpose: they live in the database and are edited from
 * the admin dashboard, so changing a link never needs a commit or a deploy.
 * The values below are only the fallbacks used before the API answers, and the
 * ones the hub falls back to permanently if no backend is configured at all.
 */
window.DLS_BETA = {
  /** Bump when the hub itself changes — it rides along on every submission. */
  hubVersion: '1.0.0',

  /**
   * Supabase edge function `betahub`, in the project that already serves cloud
   * save and the leaderboard. Blank it to run the hub in local-only mode.
   */
  apiBase: 'https://gyxmoqanjdvvllwjfsst.supabase.co/functions/v1/betahub',

  /** Used to build recruitment + referral links in the admin tools. */
  siteBase: 'https://wrexist.github.io/DeepLifeSimulator/android/',

  /** Fallbacks. The API's stored config wins whenever it answers. */
  fallback: {
    playBetaUrl: '',
    playStoreUrl: 'https://play.google.com/store/apps/details?id=com.deeplife.simulator',
    websiteUrl: 'https://wrexist.github.io/DeepLifeSimulator/',
    discordUrl: 'https://discord.gg/rzktazdX8v',
    privacyUrl: 'https://wrexist.github.io/DeepLifeSimulator/privacy.html',
    supportEmail: 'deeplifesimulator@gmail.com',
    appVersion: '2.9.0',
    betaStatus: 'open',
    targetTesters: 20,
    mode: 'beta',
    referralRewardNote: '',
  },

  /** Recruitment sources the admin link generator offers as one-click presets. */
  sources: [
    'reddit', 'discord', 'tiktok', 'instagram', 'youtube', 'x',
    'facebook', 'friend', 'indie', 'test-for-test', 'testflight', 'direct',
  ],
};
