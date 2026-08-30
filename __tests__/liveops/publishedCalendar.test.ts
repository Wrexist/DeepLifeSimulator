/**
 * The PUBLISHED calendar, validated in CI.
 *
 * WHY THIS EXISTS. `support-site/liveops.json` is served to every player from
 * GitHub Pages, and editing it is deliberately a one-file change with no app
 * update and no review - which is exactly what makes it worth a guard. Without
 * one, a trailing comma or a mistyped objective id is discovered by the device,
 * silently, as an event that simply never appears.
 *
 * The device is not defenceless: a malformed definition is dropped on its own
 * and every reward is capped before it can pay. But "the safety net caught it"
 * is a worse outcome than "CI told you before you pushed", and the safety net
 * cannot tell you WHICH event you lost.
 *
 * These run the payload through the very same `resolvePayload` the app uses, so
 * this test cannot drift from the runtime rules by construction.
 */
import fs from 'fs';
import path from 'path';
import { resolvePayload } from '@/lib/liveops/remote';
import { LOCAL_EVENTS } from '@/lib/liveops/catalogue';
import { windowFor } from '@/lib/liveops/schedule';
import { bundleValueInGems, WEEKLY_BUDGET_GEMS } from '@/lib/liveops/rewards';
import { PROGRESSION_STAGES } from '@/lib/analytics/progression';

const FILE = path.resolve(__dirname, '..', '..', 'support-site', 'liveops.json');

function readPayload(): unknown {
  const raw = fs.readFileSync(FILE, 'utf-8');
  return JSON.parse(raw);
}

describe('the URL shipped binaries will ask for', () => {
  // This is the one thing in the whole system that CANNOT be fixed after
  // release. `EXPO_PUBLIC_*` values are inlined at build time, so a binary that
  // shipped with a wrong URL asks for the wrong URL forever - the content is
  // editable, the address is not. The file's location in `support-site/` IS its
  // address, because deploy-support-site.yml uploads that folder wholesale.
  const easConfig = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, '..', '..', 'eas.json'), 'utf-8'),
  ) as { build: Record<string, { env?: Record<string, string> }> };

  const EXPECTED = 'https://wrexist.github.io/DeepLifeSimulator/liveops.json';

  it.each(['production', 'preview'])('%s points at the file this repo publishes', (profile) => {
    expect(easConfig.build[profile]?.env?.EXPO_PUBLIC_LIVEOPS_URL).toBe(EXPECTED);
  });

  it('and that URL resolves to a file that actually exists here', () => {
    // The guard that ties the two halves together: renaming or moving the JSON
    // would leave every shipped build fetching a 404, and nothing else in the
    // repo would notice.
    const servedPath = EXPECTED.split('/DeepLifeSimulator/')[1];
    expect(fs.existsSync(path.resolve(__dirname, '..', '..', 'support-site', servedPath))).toBe(true);
  });
});

describe('the published live-ops calendar', () => {
  it('is valid JSON at the path GitHub Pages serves', () => {
    // support-site/ is uploaded wholesale by deploy-support-site.yml, so the
    // file's location IS its URL. Moving it silently changes the URL the
    // shipped binaries are asking for, and those cannot be updated.
    expect(fs.existsSync(FILE)).toBe(true);
    expect(() => readPayload()).not.toThrow();
  });

  it('has every event accepted by the same validator the device runs', () => {
    const resolved = resolvePayload(readPayload(), 'remote');
    // A rejected event is one that will never reach a player. Asserting on the
    // full list rather than a count means the failure message names it.
    expect(resolved.rejected).toEqual([]);
  });

  it('actually adds events rather than silently publishing nothing', () => {
    // A payload that parses but contributes no events looks identical to a
    // healthy one from the outside.
    const resolved = resolvePayload(readPayload(), 'remote');
    expect(resolved.events.length).toBeGreaterThan(LOCAL_EVENTS.length);
  });

  it('is not left paused or blanket-disabled by accident', () => {
    // Both are real operational tools. Neither should survive in a committed
    // calendar without someone meaning it, and a forgotten `paused: true` takes
    // the whole system off the air for every player.
    const resolved = resolvePayload(readPayload(), 'remote');
    expect(resolved.paused).toBe(false);
    expect(resolved.disabledEventIds).toEqual([]);
  });

  it('never owes one player more in a week than the budget will pay', () => {
    // The device refuses an overspend, so this is not a correctness risk - it
    // is a broken promise. An event a player completed and then cannot claim
    // costs more trust than the gems are worth, and the calendar should never
    // be authored into that corner. Checked across local AND remote together,
    // because the budget does not care which file an event came from.
    const events = resolvePayload(readPayload(), 'remote').events;
    const instants = events.flatMap((e) => {
      const w = windowFor(e)!;
      return [w.startsAt, w.endsAt - 1, w.claimUntil - 1];
    });

    for (const stage of PROGRESSION_STAGES) {
      for (const at of instants) {
        const concurrent = events.filter((e) => {
          const w = windowFor(e)!;
          if (at < w.startsAt || at >= w.claimUntil) return false;
          const targeted = e.eligibility?.stages;
          return !targeted || targeted.includes(stage);
        });
        const total = concurrent.reduce((sum, e) => sum + bundleValueInGems(e.rewards), 0);
        expect({ stage, ids: concurrent.map((e) => e.id), total }).toEqual({
          stage,
          ids: expect.any(Array),
          total: expect.any(Number),
        });
        expect(total).toBeLessThanOrEqual(WEEKLY_BUDGET_GEMS);
      }
    }
  });

  it('leaves no stage with a months-long gap in the calendar', () => {
    // A stage that goes a whole quarter with nothing to do learns that the card
    // is not for them and stops looking. This is the check that catches a
    // calendar which is technically valid and practically empty for somebody.
    const events = resolvePayload(readPayload(), 'remote').events;
    const MONTH = 31 * 24 * 60 * 60 * 1000;
    const from = Date.parse('2026-09-01T00:00:00Z');
    const to = Date.parse('2027-02-01T00:00:00Z');

    for (const stage of PROGRESSION_STAGES) {
      let longestGap = 0;
      let gapStart: number | null = null;
      for (let at = from; at < to; at += 24 * 60 * 60 * 1000) {
        const live = events.some((e) => {
          const w = windowFor(e)!;
          if (at < w.startsAt || at >= w.endsAt) return false;
          // The returning-player event is excluded: it is real coverage, but
          // only for someone who has been away, so counting it would hide a gap
          // from every player who shows up daily.
          if (e.kind === 'returning') return false;
          const targeted = e.eligibility?.stages;
          return !targeted || targeted.includes(stage);
        });
        if (live) {
          gapStart = null;
        } else {
          if (gapStart === null) gapStart = at;
          longestGap = Math.max(longestGap, at - gapStart);
        }
      }
      expect({ stage, gapDays: Math.round(longestGap / (24 * 60 * 60 * 1000)) }).toEqual({
        stage,
        gapDays: expect.any(Number),
      });
      expect(longestGap).toBeLessThan(2 * MONTH);
    }
  });
});
