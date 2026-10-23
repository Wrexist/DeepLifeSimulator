/**
 * v57: the career ladder rescales (ECO-6 / ECO-8) reach existing saves, and the
 * six new fields are carve-outs the migration must NOT write.
 *
 * Career ladders are stored BY VALUE (the v53/v54 rule): payroll reads the
 * saved `levels[].salary`, so a new ladder in code alone would only reach new
 * lives. The migration re-runs the v54 adoption for known ids.
 */
import { runMigrations } from '@/utils/saveMigrations';
import { INITIAL_CAREERS } from '@/lib/careers/careerData';
import { STATE_VERSION } from '@/contexts/game/initialState';
import { createTestGameState } from '../helpers/createTestGameState';

type AnyState = Record<string, any>;

/** The ladders as v56 shipped them, for careers v57 changes. */
const V56_LADDERS: Record<string, number[]> = {
  therapist: [110, 210, 355, 505, 655, 850],
  architect: [200, 350, 500, 700, 950, 1300],
};

function v56Save(): AnyState {
  const s = JSON.parse(JSON.stringify(createTestGameState({ weeksLived: 600 }))) as AnyState;
  s.version = 56;
  for (const [id, ladder] of Object.entries(V56_LADDERS)) {
    const career = s.careers.find((c: AnyState) => c.id === id);
    if (!career) continue;
    career.levels = career.levels.map((lvl: AnyState, i: number) => ({ ...lvl, salary: ladder[i] ?? lvl.salary }));
    career.level = 3;
    career.progress = 44;
    career.accepted = true;
  }
  return s;
}

const migrate = (s: AnyState) => runMigrations(JSON.parse(JSON.stringify(s)));

describe('v57 migration', () => {
  it('is at or below the current version', () => {
    expect(STATE_VERSION).toBeGreaterThanOrEqual(57);
  });

  it('adopts the new ladders for known careers', () => {
    const save = v56Save();
    for (const id of Object.keys(V56_LADDERS)) {
      const before = save.careers.find((c: AnyState) => c.id === id);
      expect(before).toBeTruthy(); // the fixture must carry the career
      expect(before.levels.map((l: AnyState) => l.salary)).toEqual(V56_LADDERS[id]);
    }

    const { state, errors } = migrate(save);
    expect(errors).toEqual([]);
    expect((state as AnyState).version).toBe(STATE_VERSION);
    for (const id of Object.keys(V56_LADDERS)) {
      const out = (state as AnyState).careers.find((c: AnyState) => c.id === id);
      const code = INITIAL_CAREERS.find((c) => c.id === id)!;
      expect(out.levels.map((l: AnyState) => l.salary)).toEqual(code.levels.map((l) => l.salary));
    }
    const therapist = (state as AnyState).careers.find((c: AnyState) => c.id === 'therapist');
    expect(therapist.levels[therapist.levels.length - 1].salary).toBe(1600);
  });

  it('leaves the janitor, retail and fast-food ladders at their v56 pay (ECO-8 moved to the chef profile)', () => {
    const save = v56Save();
    const ladders = (s: AnyState) =>
      ['janitor', 'retail', 'fast_food'].map((id) => s.careers.find((c: AnyState) => c.id === id).levels.map((l: AnyState) => l.salary));
    const before = ladders(save);
    expect(before[0]).toEqual([110, 130, 135, 135, 165, 200]);
    expect(ladders(migrate(save).state as AnyState)).toEqual(before);
  });

  it('never touches progress', () => {
    const { state } = migrate(v56Save());
    for (const id of Object.keys(V56_LADDERS)) {
      const career = (state as AnyState).careers.find((c: AnyState) => c.id === id);
      expect(career).toMatchObject({ level: 3, progress: 44, accepted: true });
    }
  });

  it('writes none of the six carve-outs', () => {
    const { state } = migrate(v56Save());
    const s = state as AnyState;
    expect('ageOffsetWeeks' in s).toBe(false);
    expect('deathRibbonPaidForLife' in s).toBe(false);
    expect('notificationPrefs' in s.settings).toBe(false);
    expect('lastAdVitalityGrantWeek' in s.settings).toBe(false);
    expect(s.cryptoMarket && 'weekVolume' in s.cryptoMarket).toBeFalsy();
    expect(s.stocks && 'weekVolume' in s.stocks).toBeFalsy();
  });

  it('is idempotent', () => {
    const once = migrate(v56Save()).state;
    const twice = runMigrations(JSON.parse(JSON.stringify({ ...(once as AnyState), version: 56 }))).state;
    expect((twice as AnyState).careers).toEqual((once as AnyState).careers);
  });
});
