/**
 * DO SYSTEMS PRODUCE STORIES? — Master Program 12, §15.
 *
 * Manual: `RUN_SOCIAL_STORIES=1 npx jest socialStories --silent=false`.
 *
 * The brief's target is a life where a crisis, a relationship and a career
 * interact without any of it being scripted:
 *
 *   the player is in trouble → somebody close shows up → the life changes →
 *   the relationship changes with it.
 *
 * This drives a life that can actually reach that state (it builds bonds, and
 * it gets into trouble) and prints the JOURNAL — the game's own record of what
 * happened, written by the tick, not by this test. A story is only real if the
 * game wrote it down.
 */
import {
  runPersona,
  meetIfOffered,
  keepInTouch,
  answerPendingEvents,
  answerLifeMoment,
  type SimPolicy,
  type SimWeekContext,
} from '../helpers/earlyGameSim';
import { PERSONAS } from '../helpers/earlyGamePersonas';
import { closeCircle, supportCircle } from '@/lib/social/closeness';
import { friendSupportEventTemplates } from '@/lib/events/friendSupportEvents';

const RUN = process.env.RUN_SOCIAL_STORIES === '1';
const d = RUN ? describe : describe.skip;

jest.setTimeout(30 * 60 * 1000);

const SUPPORT_IDS = new Set(friendSupportEventTemplates.map((t) => t.id));

/**
 * Somebody who builds relationships AND lives a precarious life — the state
 * where the support events can exist. A comfortable player never needs anyone,
 * which is correct and is also why the comfortable personas never see these.
 */
function precariousButConnected(): SimPolicy {
  const inner = PERSONAS['C careful']();
  return async (ctx: SimWeekContext) => {
    await inner(ctx);
    await meetIfOffered(ctx);
    await keepInTouch(ctx, { hangOut: true, budget: 60 });
    // ANSWER WHAT THE GAME RAISES. The first cut of this probe left it out and
    // measured a life with an empty `eventLog` - 250 weeks, zero events
    // resolved - which read as "the support events never fire" when what it
    // actually measured was a player who never opened a single modal. The same
    // mistake Program 9 and Program 10 each recorded once (`tasks/lessons.md`);
    // it is apparently worth making a third time to learn.
    await answerPendingEvents(ctx);
    await answerLifeMoment(ctx);
  };
}

/**
 * Somebody who is genuinely struggling AND has people — the audience the crisis
 * events are for. The careful persona above never needs rescuing, which is the
 * correct outcome and also means it cannot measure whether rescue works.
 */
function strugglingButConnected(): SimPolicy {
  const inner = PERSONAS['D struggling']();
  return async (ctx: SimWeekContext) => {
    await inner(ctx);
    await meetIfOffered(ctx);
    await keepInTouch(ctx, { hangOut: false });
    await answerPendingEvents(ctx);
    await answerLifeMoment(ctx);
  };
}

d('a life where people and trouble meet', () => {
  it('prints the journal, and reports whether anybody ever showed up', async () => {
    const seeds = [1, 2, 3, 4];
    let livesWithSupport = 0;
    const out: string[] = [];
    const say = (line: string) => {
      out.push(line);
      console.log(line);
    };

    for (const seed of seeds) {
      const struggling = seed % 2 === 0;
      const r = await runPersona({
        name: `story-${seed}`,
        scenarioId: 'immigrant_story',
        seed,
        weeks: 250,
        policy: struggling ? strugglingButConnected() : precariousButConnected(),
      });

      const supportAnswered = (r.finalState.eventLog ?? []).filter((e) => SUPPORT_IDS.has(e.id));
      if (supportAnswered.length > 0) livesWithSupport++;

      say(
        `\n--- life seed ${seed} (${struggling ? 'struggling' : 'careful'}) · ${r.died ? `died wk ${r.deathWeek} (${r.deathReason})` : 'alive'} · close ${closeCircle(r.finalState).length} · trusted ${supportCircle(r.finalState).length} · EVENTS ANSWERED ALL-TIME ${(r.finalState.eventLog ?? []).length} · of which support ${supportAnswered.length}`,
      );
      for (const e of supportAnswered) {
        say(`    wk ${e.weeksLived ?? e.week}  ${e.id} -> ${e.choiceId ?? e.choice}`);
      }
      say('    JOURNAL (relationship + family entries):');
      for (const j of r.finalState.journal ?? []) {
        if (!(j.tags ?? []).some((t) => t === 'relationship' || t === 'family')) continue;
        say(`      wk ${j.atWeek}  ${j.title} - ${j.details.slice(0, 90)}`);
      }
    }

    say(`\n${livesWithSupport}/${seeds.length} lives had somebody show up.`);
    if (process.env.DUMP) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('fs').writeFileSync(process.env.DUMP, out.join('\n'));
    }
    expect(seeds.length).toBeGreaterThan(0);
  });
});
