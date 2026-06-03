import { computeQuality, qualityMultiplier } from '../quality';
import { GamingEquipment, PCUpgradeLevels } from '@/contexts/game/types';

const emptyEquip: GamingEquipment = {
  microphone: false, webcam: false, gamingChair: false, greenScreen: false, lighting: false,
};
const emptyPC: PCUpgradeLevels = {
  cpu: 0, gpu: 0, ram: 0, ssd: 0, motherboard: 0, cooling: 0, psu: 0, case: 0, network: 0,
};

describe('computeQuality', () => {
  it('returns 0 / starter when nothing is owned', () => {
    const q = computeQuality(emptyEquip, emptyPC);
    expect(q.total).toBe(0);
    expect(q.tier).toBe('starter');
  });

  it('adds accessory weights', () => {
    const q = computeQuality({ ...emptyEquip, microphone: true, lighting: true }, emptyPC);
    // mic 5 + lighting 4 = 9
    expect(q.accessories).toBe(9);
    expect(q.pc).toBe(0);
  });

  it('adds PC tier weights', () => {
    const q = computeQuality(emptyEquip, { ...emptyPC, gpu: 3, cpu: 2 });
    // gpu 4*3=12 + cpu 4*2=8 = 20
    expect(q.pc).toBe(20);
  });

  it('caps total at 100', () => {
    const fullEquip: GamingEquipment = {
      microphone: true, webcam: true, gamingChair: true, greenScreen: true, lighting: true,
    };
    const maxPC: PCUpgradeLevels = {
      cpu: 10, gpu: 10, ram: 10, ssd: 10, motherboard: 10, cooling: 10, psu: 10, case: 10, network: 10,
    };
    const q = computeQuality(fullEquip, maxPC);
    expect(q.total).toBe(100);
    expect(q.tier).toBe('elite');
  });

  it('handles undefined inputs gracefully', () => {
    expect(computeQuality(undefined, undefined).total).toBe(0);
  });
});

describe('qualityMultiplier', () => {
  it('starter 0.5, budget 1.0, pro 1.6, elite 2.5', () => {
    expect(qualityMultiplier(10)).toBe(0.5);
    expect(qualityMultiplier(40)).toBe(1.0);
    expect(qualityMultiplier(60)).toBe(1.6);
    expect(qualityMultiplier(90)).toBe(2.5);
  });
});
