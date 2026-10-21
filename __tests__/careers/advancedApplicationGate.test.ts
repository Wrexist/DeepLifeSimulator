/**
 * TAB-1: the advanced-career Apply skipped the employed / retired / pending
 * gates, and `applyCareerApplications` never reviews an application while
 * one of them holds - so the application read "pending" forever.
 */
import { applicationBlockReason } from '@/lib/careers/applicationOdds';
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const fs = require('fs');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const path = require('path');

describe('applicationBlockReason', () => {
  const base = createTestGameState({ currentJob: undefined, isRetired: false });

  it('allows an application from an unemployed, working-age player with nothing pending', () => {
    expect(applicationBlockReason({ ...base, careers: base.careers.map((c) => ({ ...c, applied: false })) })).toBeNull();
  });

  it('refuses while employed', () => {
    expect(applicationBlockReason({ ...base, currentJob: 'fast_food' })).toMatch(/Quit your current job/);
  });

  it('refuses once retired', () => {
    expect(applicationBlockReason({ ...base, isRetired: true })).toMatch(/retired/);
  });

  it('refuses while another application is pending', () => {
    const careers = base.careers.map((c, i) => (i === 0 ? { ...c, applied: true, accepted: false } : { ...c, applied: false }));
    expect(applicationBlockReason({ ...base, careers })).toMatch(/pending/);
  });
});

describe('the advanced-career card uses the gate in the card AND inside the updater', () => {
  const src: string = fs.readFileSync(path.join(process.cwd(), 'app', '(tabs)', 'work.tsx'), 'utf8');
  const card = src.slice(src.indexOf('const renderAdvancedCareerCard'), src.indexOf('const sortedCareers'));

  it('locks the card', () => {
    expect(card).toMatch(/else if \(applicationBlockReason\(gameState\)\)/);
  });

  it('re-checks against prev so a same-batch hire cannot slip an application through', () => {
    expect(card).toMatch(/if \(applicationBlockReason\(prev\)\) return prev;/);
  });
});
