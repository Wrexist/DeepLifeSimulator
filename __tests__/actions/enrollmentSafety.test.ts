import type { GameState } from '@/contexts/game/types';
import { enrollInProgram, withdrawFromProgram } from '@/contexts/game/actions/EducationActions';
import { createTestGameState } from '../helpers/createTestGameState';
import { EDUCATION_PROGRAMS } from '@/lib/education/programs';

const program = EDUCATION_PROGRAMS.find(p => p.id === 'business_degree')!;
const spec = { ...program, templateId: program.id };
function store(initial = createTestGameState({ stats: { money: 200_000 }, educations: [], loans: [] })) {
  let state = initial;
  const set: React.Dispatch<React.SetStateAction<GameState>> = u => { state = typeof u === 'function' ? u(state) : u; };
  return { set, get: () => state };
}

describe('enrollment charges once per program', () => {
  it.each(['cash', 'loan'] as const)('rejects repeated %s enrollment inside the same batch', mode => {
    const s = store();
    enrollInProgram(s.set, { ...spec, mode });
    const once = s.get();
    enrollInProgram(s.set, { ...spec, mode });
    expect(s.get()).toBe(once);
    expect(s.get().educations).toHaveLength(1);
    expect(s.get().loans).toHaveLength(mode === 'loan' ? 1 : 0);
    expect(s.get().stats.money).toBe(mode === 'loan' ? 200_000 : 200_000 - program.cost);
  });
  it.each([{ completed: true }, { paused: true }])('keeps an existing program intact: %j', flag => {
    const s = store();
    enrollInProgram(s.set, { ...spec, mode: 'cash' });
    s.set(prev => ({ ...prev, educations: prev.educations.map(e => ({ ...e, ...flag })) }));
    const before = s.get();
    enrollInProgram(s.set, { ...spec, mode: 'loan' });
    expect(s.get()).toBe(before);
  });
  it('rejects a stale confirmation after the character dies', () => {
    const initial = createTestGameState({ showDeathPopup: true, educations: [], loans: [] });
    const s = store(initial);
    enrollInProgram(s.set, { ...spec, mode: 'loan' });
    expect(s.get()).toBe(initial);
  });
  it('allows re-enrollment after withdrawal but keeps the old debt', () => {
    const s = store();
    enrollInProgram(s.set, { ...spec, mode: 'loan' });
    const oldLoan = s.get().loans![0];
    withdrawFromProgram(s.set, program.id);
    enrollInProgram(s.set, { ...spec, mode: 'loan' });
    expect(s.get().educations).toHaveLength(1);
    expect(s.get().loans).toHaveLength(2);
    expect(s.get().loans![0]).toEqual(oldLoan);
  });
});
