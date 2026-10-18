/**
 * v54: careers / street jobs / items are stored BY VALUE, so the 2026-08 income
 * rescales never reached a save started before them (the v53 diet precedent),
 * and every pre-Program-8 save still shares the template `'initial-lineage'`
 * salt. The migration fixes both; this pins what it may and may not touch.
 */
import { runMigrations, deriveLineageId, needsLineageMint } from '@/utils/saveMigrations';
import { repairGameState } from '@/utils/saveValidation';
import { INITIAL_CAREERS } from '@/lib/careers/careerData';
import { initialGameState } from '@/contexts/game/initialState';
import { createTestGameState } from '../helpers/createTestGameState';

type AnyState = Record<string, any>;

const codeEntrySalary = INITIAL_CAREERS.find((c) => c.id === 'fast_food')!.levels[0].salary;
const codeBegPay = initialGameState.streetJobs.find((j) => j.id === 'beg')!.basePayment;
const codePhonePrice = initialGameState.items.find((i) => i.id === 'smartphone')!.price;

/** A v53 save as an older build wrote it: pre-rescale values, player progress, template lineage. */
function v53Save(): AnyState {
  const s = JSON.parse(JSON.stringify(createTestGameState({ weeksLived: 300 }))) as AnyState;
  s.version = 53;
  s.lineageId = 'initial-lineage';

  const fastFood = s.careers.find((c: AnyState) => c.id === 'fast_food');
  fastFood.levels[0].salary = 50;
  fastFood.levels[1].salary = 60;
  fastFood.level = 2;
  fastFood.progress = 37;
  fastFood.accepted = true;
  fastFood.applied = true;
  fastFood.raiseMultiplier = 1.1;
  s.careers.push({ ...JSON.parse(JSON.stringify(fastFood)), id: 'modded_job', levels: [{ name: 'Modder', salary: 999 }] });

  const beg = s.streetJobs.find((j: AnyState) => j.id === 'beg');
  beg.basePayment = 100;
  beg.rank = 3;
  beg.progress = 2;
  s.streetJobs.push({ ...beg, id: 'modded_hustle', basePayment: 777 });

  const phone = s.items.find((i: AnyState) => i.id === 'smartphone');
  phone.price = 900;
  phone.owned = true;
  return s;
}

const migrate = (s: AnyState): AnyState => runMigrations(JSON.parse(JSON.stringify(s))).state as AnyState;

describe('v54 catalogue repricing', () => {
  it('the code values really differ from the stale ones (otherwise this proves nothing)', () => {
    expect(codeEntrySalary).toBe(110);
    expect(codeBegPay).toBe(40);
    expect(codePhonePrice).toBe(600);
  });

  it('adopts the code salary / basePayment / price for known ids', () => {
    const out = migrate(v53Save());
    // Runs on to the current version; v54 is the step under test.
    expect(out.version).toBeGreaterThanOrEqual(54);

    const fastFood = out.careers.find((c: AnyState) => c.id === 'fast_food');
    const catalogue = INITIAL_CAREERS.find((c) => c.id === 'fast_food')!;
    expect(fastFood.levels.map((l: AnyState) => l.salary)).toEqual(catalogue.levels.map((l) => l.salary));
    expect(fastFood.levels.map((l: AnyState) => l.name)).toEqual(catalogue.levels.map((l) => l.name));
    expect(out.streetJobs.find((j: AnyState) => j.id === 'beg').basePayment).toBe(codeBegPay);
    expect(out.items.find((i: AnyState) => i.id === 'smartphone').price).toBe(codePhonePrice);
  });

  it('never touches player progress', () => {
    const out = migrate(v53Save());
    const fastFood = out.careers.find((c: AnyState) => c.id === 'fast_food');
    expect(fastFood).toMatchObject({ level: 2, progress: 37, accepted: true, applied: true, raiseMultiplier: 1.1 });
    expect(out.streetJobs.find((j: AnyState) => j.id === 'beg')).toMatchObject({ rank: 3, progress: 2 });
    expect(out.items.find((i: AnyState) => i.id === 'smartphone').owned).toBe(true);
  });

  it('leaves unknown ids exactly as saved', () => {
    const out = migrate(v53Save());
    expect(out.careers.find((c: AnyState) => c.id === 'modded_job').levels).toEqual([{ name: 'Modder', salary: 999 }]);
    expect(out.streetJobs.find((j: AnyState) => j.id === 'modded_hustle').basePayment).toBe(777);
  });
});

describe('v54 lineage mint', () => {
  it('replaces the template literal with a minted id', () => {
    const out = migrate(v53Save());
    expect(needsLineageMint(out.lineageId)).toBe(false);
    expect(out.lineageId).toMatch(/^life_/);
  });

  it('is deterministic: the same un-resaved v53 file loads as the same life every time', () => {
    const save = v53Save();
    expect(migrate(save).lineageId).toBe(migrate(save).lineageId);
  });

  it('is minted once: a second load of the migrated save keeps it', () => {
    const first = migrate(v53Save());
    const reloaded = migrate(first); // already v54 - no migration runs
    repairGameState(reloaded);
    expect(reloaded.lineageId).toBe(first.lineageId);
  });

  it('different lives get different lineages', () => {
    const other = v53Save();
    other.weeksLived = 301;
    expect(migrate(other).lineageId).not.toBe(migrate(v53Save()).lineageId);
  });

  it('keeps a lineage that was already minted', () => {
    const save = v53Save();
    save.lineageId = 'life_123_abc';
    expect(migrate(save).lineageId).toBe('life_123_abc');
  });

  it('repair mirror: a save MISSING lineageId gets one minted, and says so', () => {
    const s = JSON.parse(JSON.stringify(createTestGameState())) as AnyState;
    delete s.lineageId;
    const result = repairGameState(s);
    expect(result.repaired).toBe(true);
    expect(needsLineageMint(s.lineageId)).toBe(false);
    expect(s.lineageId).toMatch(/^life_v54_/);
  });

  it('deriveLineageId never consults Math.random or the clock', () => {
    const save = v53Save();
    const random = jest.spyOn(Math, 'random');
    const now = jest.spyOn(Date, 'now');
    deriveLineageId(save);
    expect(random).not.toHaveBeenCalled();
    expect(now).not.toHaveBeenCalled();
    random.mockRestore();
    now.mockRestore();
  });
});
