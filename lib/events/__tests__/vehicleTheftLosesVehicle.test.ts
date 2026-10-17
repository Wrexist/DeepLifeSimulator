/**
 * "It's gone for good" has to take the car.
 *
 * The unrecovered branch of `vehicle_theft` only paid out: an insured player
 * received half the car's price and kept the car, so the theft was a windfall.
 * 2026-10-17 audit. The choice now carries the `lose_vehicle` special keyed on
 * the stolen vehicle; the handler is pinned in
 * __tests__/stress/eventResolutionFlow.stress.test.ts.
 */
import { eventTemplates } from '../engine';
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';

const theft = eventTemplates.find((t) => t.id === 'vehicle_theft')!;

describe('vehicle_theft', () => {
  it('removes the stolen vehicle when it is not recovered, and only then', () => {
    let lost = 0;
    let recovered = 0;
    for (let week = 100; week < 400 && (lost === 0 || recovered === 0); week++) {
      const state = createTestGameState({
        weeksLived: week,
        vehicles: [{ id: 'sedan', name: 'Sedan', price: 20_000, insurance: { active: true } } as never],
        activeVehicleId: 'sedan',
      });
      const event = theft.generate(state);
      const accept = event.choices.find((c) => c.id === 'accept');
      if (accept) {
        lost++;
        expect(accept.special).toBe('lose_vehicle');
        expect(accept.vehicleId).toBe('sedan');
      } else {
        recovered++;
        for (const c of event.choices) expect(c.special).toBeUndefined();
      }
    }
    expect(lost).toBeGreaterThan(0);
    expect(recovered).toBeGreaterThan(0);
  });
});
