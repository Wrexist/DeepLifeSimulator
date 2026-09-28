import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Pressable } from 'react-native';
import CreateCompanyScreen from '@/components/mobile/Hustle/screens/CreateCompanyScreen';
import HireEmployeeModal from '@/components/mobile/Hustle/modals/HireEmployeeModal';
import IPOModal from '@/components/mobile/Hustle/modals/IPOModal';
import AcquireModal from '@/components/mobile/Hustle/modals/AcquireModal';
import AmountSlider from '@/components/ui/AmountSlider';
import { businessState } from '../helpers/businessFixture';
import type { GameState } from '@/contexts/game/types';
import { hustleHaptics } from '@/components/mobile/Hustle/utils/hustleHaptics';
import { gameAlert } from '@/utils/gameAlert';

let mockRace: 'none' | 'money' | 'company' | 'revenue' = 'none';
let mockCommitted: GameState;
let mockFounding = false;
const mockSave = jest.fn();
Object.assign(jest.requireMock('react-native'), { PanResponder: { create: (handlers: object) => ({ panHandlers: handlers }) } });
jest.mock('@/hooks/useTheme', () => ({ useTheme: () => ({ theme: jest.requireActual('@/lib/config/theme').getThemeColors(true), darkMode: true }) }));
jest.mock('@/utils/gameAlert', () => ({ gameAlert: jest.fn() }));
jest.mock('@/components/ui/BaseModal', () => ({ __esModule: true, default: ({ children }: { children: React.ReactNode }) => children }));
jest.mock('@/components/mobile/Hustle/utils/hustleHaptics', () => ({ hustleHaptics: { tap: jest.fn(), success: jest.fn(), warning: jest.fn(), error: jest.fn() } }));
jest.mock('@/contexts/GameContext', () => ({ useGame: () => {
  const [gameState, setState] = React.useState(() => { const s = businessState(); if (mockFounding) { s.companies = []; s.educations = [{ id: 'entrepreneurship', name: 'Entrepreneurship', description: '', cost: 0, duration: 52, weeksRemaining: 0, completed: true }]; } return s; });
  mockCommitted = gameState;
  return { gameState, saveGame: mockSave, setGameState: (update: React.SetStateAction<GameState>) => setState(prev => {
    const latest = mockRace === 'money' ? { ...prev, stats: { ...prev.stats, money: 0 } }
      : mockRace === 'company' ? { ...prev, companies: [] }
      : mockRace === 'revenue' ? { ...prev, companies: prev.companies!.map(c => ({ ...c, weeklyIncome: 100 })) } : prev;
    return typeof update === 'function' ? update(latest) : update;
  }) };
} }));
beforeEach(() => { jest.clearAllMocks(); mockRace = 'none'; mockFounding = false; });
function button(r: TestRenderer.ReactTestRenderer, label: string) { return r.root.findAllByType(Pressable).find(n => n.props.accessibilityLabel === label)!; }

it.each(['none', 'company', 'revenue'] as const)('IPO confirms only committed public status: %s', race => {
  mockRace = race;
  let r!: TestRenderer.ReactTestRenderer; act(() => { r = TestRenderer.create(<IPOModal visible companyId="factory" onDismiss={() => {}} />); });
  const launch = button(r, 'IPO My Factory with 25% float');
  act(() => { launch.props.onPress(); launch.props.onPress(); });
  expect(mockSave).toHaveBeenCalledTimes(race === 'none' ? 1 : 0);
  expect(hustleHaptics.success).toHaveBeenCalledTimes(race === 'none' ? 1 : 0);
  expect(mockCommitted.hustleApp!.companies.factory.ipo.status).toBe(race === 'none' ? 'public' : 'private');
  act(() => r.unmount());
});
it.each(['none', 'money', 'company'] as const)('acquisition reports committed completion: %s', race => {
  mockRace = race;
  let r!: TestRenderer.ReactTestRenderer; act(() => { r = TestRenderer.create(<AcquireModal visible companyId="factory" onDismiss={() => {}} />); });
  const buy = button(r, 'Accept Ironworks'); act(() => { buy.props.onPress(); buy.props.onPress(); });
  expect(mockSave).toHaveBeenCalledTimes(race === 'none' ? 1 : 0);
  expect(hustleHaptics.success).toHaveBeenCalledTimes(race === 'none' ? 1 : 0);
  expect(JSON.stringify(r.toJSON())).toContain(race === 'none' ? 'Acquired Ironworks' : 'not completed');
  act(() => r.unmount());
});
it.each(['none', 'money', 'company'] as const)('salary and bonus retain cents and acknowledge only a committed hire: %s', race => {
  let r!: TestRenderer.ReactTestRenderer; act(() => { r = TestRenderer.create(<HireEmployeeModal visible companyId="factory" onDismiss={() => {}} />); });
  act(() => r.root.findAllByType(Pressable).find(n => n.props.accessibilityRole === 'radio')!.props.onPress());
  act(() => { const inputs = r.root.findAllByType(AmountSlider); inputs[0].props.onChangeText('2000.75'); inputs[1].props.onChangeText('100.25'); });
  mockRace = race;
  const send = button(r, 'Send offer'); act(() => { send.props.onPress(); send.props.onPress(); });
  expect(mockSave).toHaveBeenCalledTimes(race === 'none' ? 1 : 0);
  expect(hustleHaptics.success).toHaveBeenCalledTimes(race === 'none' ? 1 : 0);
  if (race === 'none') {
    expect(mockCommitted.hustleApp!.companies.factory.hiringPipeline.namedHires[0].salary).toBe(2000.75);
    expect(mockCommitted.stats.money).toBe(999899.75);
    act(() => button(r, 'Fire this engineer').props.onPress());
    expect(mockCommitted.hustleApp!.companies.factory.hiringPipeline.namedHires).toHaveLength(1);
    expect(gameAlert).toHaveBeenCalledWith('Release employee?', expect.stringContaining('four weeks of salary'), expect.any(Array));
    const choices = jest.mocked(gameAlert).mock.calls[0][2]!;
    act(() => choices.find(c => c.style === 'destructive')!.onPress!());
    expect(mockCommitted.hustleApp!.companies.factory.hiringPipeline.namedHires).toHaveLength(0);
    expect(mockCommitted.stats.money).toBe(991896.75);
  }
  act(() => r.unmount());
});

it.each(['none', 'money'] as const)('founding navigates only after a committed company: %s', race => {
  mockFounding = true; mockRace = race;
  const created = jest.fn(); let r!: TestRenderer.ReactTestRenderer;
  act(() => { r = TestRenderer.create(<CreateCompanyScreen onBack={() => {}} onCreated={created} />); });
  act(() => r.root.findAllByType(Pressable).find(n => n.props.accessibilityRole === 'radio')!.props.onPress());
  const found = button(r, 'Found this company'); act(() => { found.props.onPress(); found.props.onPress(); });
  expect(created).toHaveBeenCalledTimes(race === 'none' ? 1 : 0);
  expect(mockSave).toHaveBeenCalledTimes(race === 'none' ? 1 : 0);
  expect(mockCommitted.companies).toHaveLength(race === 'none' ? 1 : 0);
  if (race === 'money') expect(JSON.stringify(r.toJSON())).toContain('Company was not founded');
  act(() => r.unmount());
});

it('saves a declined interview and reports its energy cost without charging a bonus', () => {
  let r!: TestRenderer.ReactTestRenderer; act(() => { r = TestRenderer.create(<HireEmployeeModal visible companyId="factory" onDismiss={() => {}} />); });
  act(() => r.root.findAllByType(Pressable).find(n => n.props.accessibilityRole === 'radio')!.props.onPress());
  act(() => r.root.findAllByType(AmountSlider)[0].props.onChangeText('1'));
  act(() => button(r, 'Send offer').props.onPress());
  expect(mockCommitted.stats.energy).toBe(95);
  expect(mockCommitted.stats.money).toBe(1000000);
  expect(mockCommitted.hustleApp!.companies.factory.hiringPipeline.namedHires).toHaveLength(0);
  expect(mockSave).toHaveBeenCalledTimes(1);
  expect(JSON.stringify(r.toJSON())).toContain('Interview energy was used; no bonus was charged');
  act(() => r.unmount());
});
