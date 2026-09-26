import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Pressable } from 'react-native';
import LaunchCampaignModal from '@/components/mobile/Hustle/modals/LaunchCampaignModal';
import { createTestGameState } from '../helpers/createTestGameState';
import type { GameState, Company } from '@/contexts/game/types';
import { hustleHaptics } from '@/components/mobile/Hustle/utils/hustleHaptics';

let mockRace: 'none' | 'energy' | 'money' | 'company' = 'none';
let mockCommitted: GameState;
const mockSave = jest.fn();
jest.mock('@/hooks/useTheme', () => ({ useTheme: () => ({ theme: jest.requireActual('@/lib/config/theme').getThemeColors(true), darkMode: true }) }));
jest.mock('@/components/ui/BaseModal', () => ({ __esModule: true, default: ({ children }: { children: React.ReactNode }) => children }));
jest.mock('@/components/mobile/Hustle/utils/hustleHaptics', () => ({ hustleHaptics: { tap: jest.fn(), success: jest.fn(), error: jest.fn() } }));
jest.mock('@/contexts/GameContext', () => ({ useGame: () => {
  const [gameState, setState] = React.useState(() => createTestGameState({
    stats: { money: 100000, energy: 50 },
    companies: [{ id: 'co-1', name: 'My Co', type: 'factory', weeklyIncome: 5000, baseWeeklyIncome: 5000, upgrades: [], employees: 0, workerSalary: 500, workerMultiplier: 1.1, marketingLevel: 1, miners: {}, warehouseLevel: 0 } as Company],
  }));
  mockCommitted = gameState;
  return { gameState, saveGame: mockSave, setGameState: (update: React.SetStateAction<GameState>) => setState(prev => {
    const latest = mockRace === 'energy' ? { ...prev, stats: { ...prev.stats, energy: 0 } }
      : mockRace === 'money' ? { ...prev, stats: { ...prev.stats, money: 0 } }
      : mockRace === 'company' ? { ...prev, companies: [] } : prev;
    return typeof update === 'function' ? update(latest) : update;
  }) };
} }));

beforeEach(() => { jest.clearAllMocks(); mockRace = 'none'; });

it.each(['none', 'energy', 'money', 'company'] as const)('acknowledges only a committed launch: %s race', race => {
  mockRace = race;
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => { renderer = TestRenderer.create(<LaunchCampaignModal visible companyId="co-1" onDismiss={() => {}} />); });
  act(() => renderer.root.findAllByType(Pressable).find(n => n.props.accessibilityRole === 'radio')!.props.onPress());
  const launch = renderer.root.findAllByType(Pressable).find(n => n.props.accessibilityLabel === 'Launch campaign')!;
  act(() => { launch.props.onPress(); launch.props.onPress(); });
  const campaigns = mockCommitted.hustleApp?.companies?.['co-1']?.activeCampaigns ?? [];
  if (race === 'none') {
    expect(campaigns).toHaveLength(1);
    expect(hustleHaptics.success).toHaveBeenCalledTimes(1);
    expect(mockSave).toHaveBeenCalledTimes(1);
    expect(mockCommitted.stats.money).toBe(99000);
    expect(mockCommitted.stats.energy).toBe(42);
    expect(JSON.stringify(renderer.toJSON())).toContain('Campaign launched');
  } else {
    expect(campaigns).toHaveLength(0);
    expect(hustleHaptics.success).not.toHaveBeenCalled();
    expect(mockSave).not.toHaveBeenCalled();
    expect(hustleHaptics.error).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(renderer.toJSON())).toContain('Nothing was charged');
    expect(mockCommitted.stats.money).toBe(race === 'money' ? 0 : 100000);
    expect(mockCommitted.stats.energy).toBe(race === 'energy' ? 0 : 50);
  }
  act(() => renderer.unmount());
});
