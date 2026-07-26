import {
  COSMETIC_PROCEDURES,
  SURGEON_TIERS,
  checkProcedureEligibility,
  getProcedure,
  performProcedure,
  procedureCost,
  randomizeFace,
  type CosmeticProcedureRecord,
  type SurgeonTierId,
} from '@/lib/identity';

const face = randomizeFace('surgery-patient', { sex: 'female' });
const richHealthyAdult = { age: 35, money: 10_000_000, health: 90, history: [] as CosmeticProcedureRecord[] };

describe('procedures', () => {
  describe('catalog', () => {
    it('has unique ids and sane definitions', () => {
      const ids = COSMETIC_PROCEDURES.map((p) => p.id);
      expect(new Set(ids).size).toBe(ids.length);
      for (const p of COSMETIC_PROCEDURES) {
        expect(p.baseCost).toBeGreaterThan(0);
        expect(p.minAge).toBeGreaterThanOrEqual(12);
        expect(p.recoveryWeeks).toBeGreaterThan(0);
        expect(p.baseRisk).toBeGreaterThan(0);
        expect(p.baseRisk).toBeLessThan(0.5);
        expect(Object.keys(p.effects).length).toBeGreaterThan(0);
      }
    });

    it('prices budget below standard below elite, and inverts the risk', () => {
      const costs = SURGEON_TIERS.map((t) => procedureCost('rhinoplasty', t.id));
      expect(costs[0]).toBeLessThan(costs[1]);
      expect(costs[1]).toBeLessThan(costs[2]);
      expect(SURGEON_TIERS[0].riskMultiplier).toBeGreaterThan(SURGEON_TIERS[2].riskMultiplier);
    });

    it('returns 0 cost for an unknown procedure', () => {
      expect(procedureCost('not_real', 'standard')).toBe(0);
      expect(getProcedure('not_real')).toBeUndefined();
    });
  });

  describe('checkProcedureEligibility', () => {
    it('allows a qualifying adult', () => {
      expect(checkProcedureEligibility('rhinoplasty', 'standard', richHealthyAdult).ok).toBe(true);
    });

    it('blocks under-age, broke, and unhealthy patients', () => {
      expect(checkProcedureEligibility('rhinoplasty', 'standard', { ...richHealthyAdult, age: 12 }).ok).toBe(false);
      expect(checkProcedureEligibility('rhinoplasty', 'standard', { ...richHealthyAdult, money: 5 }).ok).toBe(false);
      expect(checkProcedureEligibility('rhinoplasty', 'standard', { ...richHealthyAdult, health: 10 }).ok).toBe(false);
    });

    it('blocks a fourth revision of the same feature', () => {
      const history: CosmeticProcedureRecord[] = [
        { id: 'rhinoplasty', week: 1, outcome: 0.5 },
        { id: 'rhinoplasty', week: 20, outcome: 0.5 },
        { id: 'rhinoplasty', week: 40, outcome: 0.5 },
      ];
      const res = checkProcedureEligibility('rhinoplasty', 'standard', { ...richHealthyAdult, history });
      expect(res.ok).toBe(false);
      expect(res.reason).toMatch(/scar tissue/i);
      // A different feature is still available.
      expect(checkProcedureEligibility('lip_filler', 'standard', { ...richHealthyAdult, history }).ok).toBe(true);
    });

    it('rejects an unknown procedure', () => {
      expect(checkProcedureEligibility('not_real', 'standard', richHealthyAdult).ok).toBe(false);
    });
  });

  describe('performProcedure', () => {
    it('never mutates the input face', () => {
      const snapshot = JSON.parse(JSON.stringify(face));
      performProcedure(face, 'rhinoplasty', 'standard', 10, 0.9, richHealthyAdult);
      expect(face).toEqual(snapshot);
    });

    it('returns null for an unknown procedure', () => {
      expect(performProcedure(face, 'not_real', 'standard', 1, 0.5, richHealthyAdult)).toBeNull();
    });

    it('keeps every morph in range for every roll, procedure and tier', () => {
      for (const proc of COSMETIC_PROCEDURES) {
        for (const tier of SURGEON_TIERS) {
          for (let r = 0; r < 1; r += 0.02) {
            const res = performProcedure(face, proc.id, tier.id, 10, r, richHealthyAdult);
            expect(res).not.toBeNull();
            for (const v of Object.values(res!.face.morphs)) {
              expect(v).toBeGreaterThanOrEqual(0);
              expect(v).toBeLessThanOrEqual(1);
            }
            expect(res!.record.outcome).toBeGreaterThanOrEqual(-1);
            expect(res!.record.outcome).toBeLessThanOrEqual(1);
          }
        }
      }
    });

    it('moves the morph the intended way on a good roll', () => {
      const res = performProcedure(face, 'lip_filler', 'elite', 10, 0.99, richHealthyAdult)!;
      expect(res.botched).toBe(false);
      expect(res.face.morphs.lipFullness).toBeGreaterThan(face.morphs.lipFullness);
    });

    it('moves the morph the WRONG way on a botched roll', () => {
      // A low roll under a budget clinic is inside the failure band.
      const res = performProcedure(face, 'lip_filler', 'budget', 10, 0.001, richHealthyAdult)!;
      expect(res.botched).toBe(true);
      expect(res.record.outcome).toBeLessThan(0);
      expect(res.face.morphs.lipFullness).toBeLessThan(face.morphs.lipFullness);
      expect(res.recoveryWeeks).toBeGreaterThan(getProcedure('lip_filler')!.recoveryWeeks);
    });

    it('makes a budget clinic measurably more dangerous than a specialist', () => {
      const failures = (tierId: SurgeonTierId) => {
        let n = 0;
        for (let r = 0.0005; r < 1; r += 0.001) {
          if (performProcedure(face, 'rhinoplasty', tierId, 10, r, richHealthyAdult)!.botched) n++;
        }
        return n;
      };
      expect(failures('budget')).toBeGreaterThan(failures('standard'));
      expect(failures('standard')).toBeGreaterThan(failures('elite'));
    });

    it('raises risk with age, poor health and prior revisions', () => {
      const failuresFor = (ctx: typeof richHealthyAdult) => {
        let n = 0;
        for (let r = 0.0005; r < 1; r += 0.001) {
          if (performProcedure(face, 'rhinoplasty', 'standard', 10, r, ctx)!.botched) n++;
        }
        return n;
      };
      const baseline = failuresFor(richHealthyAdult);
      expect(failuresFor({ ...richHealthyAdult, age: 80 })).toBeGreaterThan(baseline);
      expect(failuresFor({ ...richHealthyAdult, health: 40 })).toBeGreaterThan(baseline);
      expect(failuresFor({
        ...richHealthyAdult,
        history: [{ id: 'rhinoplasty', week: 1, outcome: -0.5 }, { id: 'rhinoplasty', week: 2, outcome: -0.5 }],
      })).toBeGreaterThan(baseline);
    });

    it('cannot be looped to rail a morph — the cap bites first', () => {
      // Buy the best possible outcome three times, which is the lifetime max.
      let current = face;
      const history: CosmeticProcedureRecord[] = [];
      for (let i = 0; i < 3; i++) {
        const res = performProcedure(current, 'lip_filler', 'elite', i, 0.999, { ...richHealthyAdult, history })!;
        current = res.face;
        history.push(res.record);
      }
      expect(checkProcedureEligibility('lip_filler', 'elite', { ...richHealthyAdult, history }).ok).toBe(false);
      // Three perfect fillers is a real change but not a railed morph.
      expect(current.morphs.lipFullness).toBeLessThanOrEqual(1);
      expect(current.morphs.lipFullness - face.morphs.lipFullness).toBeLessThan(0.62);
    });

    it('always returns a player-facing message and a stamped record', () => {
      for (let r = 0; r < 1; r += 0.05) {
        const res = performProcedure(face, 'facelift', 'standard', 123, r, { ...richHealthyAdult, age: 55 })!;
        expect(typeof res.message).toBe('string');
        expect(res.message.length).toBeGreaterThan(10);
        expect(res.record.week).toBe(123);
        expect(res.record.id).toBe('facelift');
      }
    });
  });
});
