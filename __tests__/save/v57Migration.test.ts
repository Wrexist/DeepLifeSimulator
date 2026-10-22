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

/** The ladders as v56 shipped them, for the careers v57 changes. */
const V56_LADDERS: Record<string, number[]> = {
  janitor: [110, 130, 150, 170, 185, 200],
  architect: [300, 440, 600, 780, 980, 1200],
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
  it('is the current version', () => {
    expect(STATE_VERSION).toBe(57);
  });

  it('adopts the new ladders for known careers', () => {
    const save = v56Save();
    const before = save.careers.find((c: AnyState) => c.id === 'janitor');
    expect(before).toBeTruthy(); // the fixture must carry the janitor career
    expect(before.levels.map((l: AnyState) => l.salary)).toEqual(V56_LADDERS.janitor);

    const { state, errors } = migrate(save);
    expect(errors).toEqual([]);
    expect((state as AnyState).version).toBe(57);
    for (const id of Object.keys(V56_LADDERS)) {
      const out = (state as AnyState).careers.find((c: AnyState) => c.id === id);
      if (!out) continue;
      const code = INITIAL_CAREERS.find((c) => c.id === id)!;
      expect(out.levels.map((l: AnyState) => l.salary)).toEqual(code.levels.map((l) => l.salary));
    }
    const janitor = (state as AnyState).careers.find((c: AnyState) => c.id === 'janitor');
    expect(janitor.levels[janitor.levels.length - 1].salary).toBe(520);
  });

  it('never touches progress', () => {
    const { state } = migrate(v56Save());
    const janitor = (state as AnyState).careers.find((c: AnyState) => c.id === 'janitor');
    expect(janitor).toMatchObject({ level: 3, progress: 44, accepted: true });
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
