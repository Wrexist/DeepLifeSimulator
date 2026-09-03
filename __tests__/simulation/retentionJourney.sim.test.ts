/**
 * RETENTION JOURNEY SOAK — Master Program 9 (manual).
 *
 * Runs personas 100 weeks on the real tick, answering every decision the game
 * puts in front of them (inbox events, life moments), and prints a per-week
 * SIGNAL map: new decision, cliffhanger, promotion ready/taken, unlock, chapter
 * step, goal-recommendation change, anticipation row, challenge rotation, job
 * board turnover, life moment, relationship change, illness. A dead zone is
 * three or more consecutive weeks with none of them.
 *
 * RUN:  RUN_RETENTION_SIM=1 npx jest retentionJourney.sim --silent=false
 * ANSWER=0 leaves decisions unanswered (the text-skipper who never opens the inbox).
 */
import { runPersona, answerPendingEvents, answerLifeMoment, type SimPolicy, type SimWeekContext } from '../helpers/earlyGameSim';
import { PERSONAS } from '../helpers/earlyGamePersonas';
import { recommendGoals } from '@/lib/goals';
import { upcomingEvents } from '@/lib/anticipation';
import { unlockTier } from '@/lib/progress/featureUnlocks';
import { getActiveChapter, getChapterProgress } from '@/lib/progress/lifeChapters';
import { getPromotionEligibility } from '@/lib/careers/promotionGating';
import { weeksUntilBoardRefresh } from '@/lib/careers/jobMarket';

jest.mock('@/utils/saveQueue', () => ({
  saveQueue: { addToQueue: jest.fn().mockResolvedValue(undefined), forceSave: jest.fn().mockResolvedValue(undefined), flushQueue: jest.fn().mockResolvedValue(undefined), restoreOnStartup: jest.fn().mockResolvedValue(undefined), setToastCallback: jest.fn(), getStatus: jest.fn(() => ({ queueLength: 0, isProcessing: false })) },
  queueSave: jest.fn().mockResolvedValue(undefined), forceSave: jest.fn().mockResolvedValue(undefined),
}));
jest.setTimeout(3_600_000);
const describeSim = process.env.RUN_RETENTION_SIM ? describe : describe.skip;

type Sig = { week: number; signals: string[] };
const ANSWER = process.env.ANSWER !== '0';

function probe(inner: SimPolicy, out: Sig[]): SimPolicy {
  let prev: any = null;
  return async (ctx: SimWeekContext) => {
    const s = ctx.state();
    const signals: string[] = [];
    const pending = (s.pendingEvents ?? []).length;
    const tier = unlockTier(s);
    const chapter = getActiveChapter(s);
    const chapterDone = chapter ? getChapterProgress(chapter, s).completedGoals : 0;
    const goals = recommendGoals(s).map((g) => g.id).join(',');
    const career = (s.careers ?? []).find((c) => c.id === s.currentJob);
    const promo = !!s.currentJob && getPromotionEligibility(career, s.weeksLived).eligible;
    const upcoming = upcomingEvents(s).length;
    const challenge = s.weeklyChallenge?.challengeId ?? '';
    const moments = s.lifeMoments?.totalMoments ?? 0;
    const rels = (s.relationships ?? []).length;
    const level = career?.level ?? -1;
    if (prev) {
      if (pending > prev.pending) signals.push('event');
      if (s.pendingCliffhanger) signals.push('cliff');
      if (promo && !prev.promo) signals.push('promo-ready');
      if (level > prev.level) signals.push('promoted');
      if (tier > prev.tier) signals.push(`unlock-t${tier}`);
      if (chapter && chapter.id === prev.chapterId && chapterDone > prev.chapterDone) signals.push('chapter-step');
      if (chapter && chapter.id !== prev.chapterId) signals.push('chapter-new');
      if (goals !== prev.goals) signals.push('goal-change');
      if (upcoming > prev.upcoming) signals.push('anticipation');
      if (challenge !== prev.challenge) signals.push('challenge');
      if (weeksUntilBoardRefresh(s) === 8) signals.push('board');
      if (moments > prev.moments) signals.push('moment');
      if (rels !== prev.rels) signals.push('relationship');
      if ((s.diseases ?? []).length > (prev.diseases ?? 0)) signals.push('illness');
    }
    if ([1, 5, 10, 20, 35, 50, 75, 100].includes(ctx.week)) ctx.note(`goals=${goals}`);
    out.push({ week: ctx.week, signals });
    prev = { pending, promo, level, tier, chapterId: chapter?.id, chapterDone, goals, upcoming, challenge, moments, rels, diseases: (s.diseases ?? []).length };
    await inner(ctx);
    if (ANSWER) { await answerPendingEvents(ctx); await answerLifeMoment(ctx); }
  };
}

const summarize = (name: string, sigs: Sig[]) => {
  const lines: string[] = [];
  let dead = 0; let deadRuns: string[] = []; let runStart = -1;
  const counts: Record<string, number> = {};
  for (const s of sigs) {
    const real = s.signals.filter((x) => x !== 'board' && x !== 'goal-change');
    for (const x of s.signals) counts[x] = (counts[x] ?? 0) + 1;
    if (real.length === 0) { if (runStart < 0) runStart = s.week; dead++; }
    else { if (runStart >= 0 && s.week - runStart >= 3) deadRuns.push(`${runStart}-${s.week - 1}`); runStart = -1; }
  }
  if (runStart >= 0 && sigs[sigs.length - 1].week - runStart + 1 >= 3) deadRuns.push(`${runStart}-${sigs[sigs.length - 1].week}`);
  lines.push(`--- ${name}: ${sigs.length} weeks · silent weeks ${dead} · dead zones (≥3 wks): ${deadRuns.join(' ') || 'none'}`);
  lines.push(`    counts: ${Object.entries(counts).map(([k, v]) => `${k}×${v}`).join(' ')}`);
  lines.push('    ' + sigs.map((s) => `${s.week}:${s.signals.filter((x) => x !== 'board').join('+') || '.'}`).join(' '));
  return lines.join('\n');
};

describeSim('retention journey soak', () => {
it('journey signals, 100 weeks, four personas', async () => {
  const out: string[] = [];
  for (const [name, make] of Object.entries(PERSONAS)) {
    if (!['B text skipper', 'A average', 'C careful', 'E strategic'].includes(name)) continue;
    const sigs: Sig[] = [];
    const r = await runPersona({ name, policy: probe(make(), sigs), scenarioId: 'food_courier', seed: 1, weeks: 100, mutateSeed: (s) => ({ ...s, lineageId: 'life_journey' }) });
    const last = r.rows[r.rows.length - 1];
    out.push(summarize(`${name} (${r.died ? `died wk ${r.deathWeek} ${r.deathReason}` : 'alive'}; wk100 cash ${last.cash} nw ${last.netWorth} ${last.job}/${last.level} chapters ${last.chapters.length} pending ${(r.finalState.pendingEvents ?? []).length} moments ${r.finalState.lifeMoments?.totalMoments ?? 0})`, sigs));
    out.push('    ' + r.rows.filter((x) => x.notes.some((n) => n.startsWith('goals='))).map((x) => `wk${x.week} ${x.notes.find((n) => n.startsWith('goals='))}`).join(' | '));
    if (r.died) out.push('    last rows: ' + r.rows.slice(-4).map((x) => `wk${x.week} hp${x.health} ha${x.happiness} ${x.diseases.join(',')}`).join(' · '));
  }
  process.stdout.write('\n' + out.join('\n\n') + '\n');
});
});
