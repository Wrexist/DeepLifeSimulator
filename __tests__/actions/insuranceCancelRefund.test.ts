/**
 * APP-16 (audit 2026-10-21): cancelling insurance asks first, and the
 * confirmation quotes the refund the cancel actually pays. Both read
 * `insuranceCancelRefund`, so the quote cannot drift from the payout.
 */
import { createTestGameState } from '../helpers/createTestGameState';
import { createSetGameStateStub } from '../helpers/setGameStateStub';
import {
  purchaseInsurance,
  cancelInsurance,
  insuranceCancelRefund,
  INSURANCE_CANCEL_FEE,
} from '@/contexts/game/actions/VehicleActions';
import { updateMoney } from '@/contexts/game/actions/MoneyActions';
import { VEHICLE_TEMPLATES, createVehicleFromTemplate } from '@/lib/vehicles/vehicles';

describe('insuranceCancelRefund (APP-16)', () => {
  it('quotes exactly what cancelInsurance credits', () => {
    const template = VEHICLE_TEMPLATES[0];
    const car = createVehicleFromTemplate(template, 100);
    const stub = createSetGameStateStub(createTestGameState({
      weeksLived: 100,
      stats: { money: 100_000 },
      hasDriversLicense: true,
      vehicles: [car],
      activeVehicleId: car.id,
    }));
    expect(purchaseInsurance(stub.current(), stub.setGameState, car.id, 'basic', {
      updateMoney,
    }).success).toBe(true);

    // Ten weeks into the 26-week term.
    stub.setGameState((s) => ({ ...s, weeksLived: 110 }));
    const insured = stub.current();
    const policy = insured.vehicles!.find((v) => v.id === car.id)!.insurance!;
    const quote = insuranceCancelRefund(policy, insured.weeksLived);
    const premium = policy.monthlyCost * 6;
    expect(quote).toBe(Math.max(0, Math.floor(premium * (16 / 26)) - INSURANCE_CANCEL_FEE));

    const before = insured.stats.money;
    const result = cancelInsurance(insured, stub.setGameState, car.id);
    expect(result.success).toBe(true);
    expect(stub.current().stats.money - before).toBe(quote);
  });

  it('never refunds more than the premium, or less than zero', () => {
    expect(insuranceCancelRefund({ type: 'basic', monthlyCost: 100, coveragePercent: 50, active: true, expiresWeek: 500 }, 0)).toBe(600 - 25);
    expect(insuranceCancelRefund({ type: 'basic', monthlyCost: 100, coveragePercent: 50, active: true, expiresWeek: 10 }, 20)).toBe(0);
  });
});
