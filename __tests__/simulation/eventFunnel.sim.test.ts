/**
 * THE DELIVERY FUNNEL — Master Program 13, Phases 3 and 6.
 *
 * Manual: `RUN_EVENT_FUNNEL=1 npx jest eventFunnel --silent=false`
 * (`DUMP=<file>`, `LIVES=<n>`, `WEEKS=<n>`).
 *
 * Telemetry over 50 lives measured 30 distinct event ids delivered, out of the
 * several hundred the repository authors. That number alone cannot say which
 * stage loses the content, so this walks the funnel:
 *
 *   AUTHORED  — every template registered in the pool
 *      ↓
 *   ELIGIBLE  — its `condition` passed at least once in some life
 *      ↓
 *   COMPETING — it also carried a weight above zero at that moment
 *      ↓
 *   SELECTED  — the weekly pick actually chose it
 *
 * Evaluating the conditions against the SAME states the tick walked is what
 * makes this a measurement rather than a guess: a template that is never
 * eligible is dead content, and a template that is eligible every week and
 * never selected is a weighting problem. They need opposite fixes.
 */
import {
  runPersona,
  answerPendingEvents,
  answerLifeMoment,
  meetIfOffered,
  type SimPolicy,
  type SimWeekContext,
} from '../helpers/earlyGameSim';
import { PERSONAS } from '../helpers/earlyGamePersonas';
import { eventTemplates } from '@/lib/events/engine';
import type { GameState } from '@/contexts/game/types';

const RUN = process.env.RUN_EVENT_FUNNEL === '1';
const d = RUN ? describe : describe.skip;

jest.setTimeout(4 * 60 * 60 * 1000);

const LIVES = Number(process.env.LIVES ?? 12);
const WEEKS = Number(process.env.WEEKS ?? 150);

d('the event delivery funnel', () => {
  it('counts authored / eligible / competing / selected', async () => {
    /** ids whose `condition` passed at least once, anywhere. */
    const everEligible = new Set<string>();
    /** ids that were eligible AND carried weight > 0 at that moment. */
    const everCompeting = new Set<string>();
    /** how many life-weeks each id spent competing (its exposure). */
    const competingWeeks = new Map<string, number>();
    /** ids that threw while being evaluated — a broken gate. */
    const threw = new Map<string, string>();
    const selected = new Set<string>();

    const probe = (s: GameState) => {
      for (const t of eventTemplates) {
        let ok: boolean;
        try {
          ok = t.condition ? t.condition(s) : true;
        } catch (e) {
          threw.set(t.id, String((e as Error)?.message ?? e).slice(0, 80));
          continue;
        }
        if (!ok) continue;
        everEligible.add(t.id);
        let w = 0;
        try {
          w = typeof t.weight === 'function' ? t.weight(s) : t.weight;
        } catch (e) {
          threw.set(t.id, String((e as Error)?.message ?? e).slice(0, 80));
          continue;
        }
        if (w > 0) {
          everCompeting.add(t.id);
          competingWeeks.set(t.id, (competingWeeks.get(t.id) ?? 0) + 1);
        }
      }
    };

    function attentive(): SimPolicy {
      const inner = PERSONAS['A average']();
      return async (ctx: SimWeekContext) => {
        await inner(ctx);
        await meetIfOffered(ctx);
        await answerPendingEvents(ctx);
        await answerLifeMoment(ctx);
        probe(ctx.state());
      };
    }

    for (let seed = 1; seed <= LIVES; seed++) {
      const r = await runPersona({
        name: `funnel-${seed}`, scenarioId: 'food_courier', seed, weeks: WEEKS, policy: attentive(),
      });
      for (const e of r.finalState.eventLog ?? []) if (e?.id) selected.add(e.id);
    }

    const authored = eventTemplates.length;
    const neverEligible = eventTemplates.filter((t) => !everEligible.has(t.id)).map((t) => t.id);
    // Weight-0 templates are SEQUEL-ONLY by design (`followUpEventId`), not dead.
    const sequelOnly = eventTemplates
      .filter((t) => typeof t.weight === 'number' && t.weight === 0)
      .map((t) => t.id);
    const competingNeverSelected = [...everCompeting].filter((id) => !selected.has(id));

    const lines = [
      `lives=${LIVES} weeks=${WEEKS}`,
      `AUTHORED (pool templates):        ${authored}`,
      `  of which weight-0 sequel-only:  ${sequelOnly.length}`,
      `EVER ELIGIBLE (condition passed): ${everEligible.size}`,
      `EVER COMPETING (weight > 0):      ${everCompeting.size}`,
      `EVER SELECTED (delivered):        ${selected.size}`,
      `templates that THREW:             ${threw.size}`,
      '',
      `competing but never selected:     ${competingNeverSelected.length}`,
      `never eligible in ${LIVES} lives:       ${neverEligible.length}`,
      '',
      'TOP 15 BY EXPOSURE (life-weeks competing):',
      ...[...competingWeeks.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 15)
        .map(([id, n]) => `  ${String(n).padStart(5)}  ${id}${selected.has(id) ? '' : '   <- never selected'}`),
      '',
      'NEVER ELIGIBLE (first 40): ' + neverEligible.slice(0, 40).join(', '),
      threw.size ? 'THREW: ' + [...threw.entries()].map(([k, v]) => `${k} (${v})`).join(' | ') : 'THREW: none',
    ];
    for (const l of lines) console.log(l);

    if (process.env.DUMP) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('fs').writeFileSync(
        process.env.DUMP,
        JSON.stringify(
          {
            summary: lines,
            authored,
            everEligible: [...everEligible],
            everCompeting: [...everCompeting],
            selected: [...selected],
            neverEligible,
            sequelOnly,
            competingNeverSelected,
            competingWeeks: Object.fromEntries(competingWeeks),
            threw: Object.fromEntries(threw),
          },
          null,
          1,
        ),
      );
    }
    expect(authored).toBeGreaterThan(0);
  });
});
