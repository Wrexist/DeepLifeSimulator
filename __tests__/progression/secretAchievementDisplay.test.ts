/**
 * VIS-2: the achievements browser showed every LOCKED secret's real name and
 * unlock condition. A secret stays hidden until it is earned.
 */
import { achievementDisplay } from '@/lib/progress/achievementDisplay';
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';

describe('achievementDisplay', () => {
  const secrets = createTestGameState().achievements.filter((a) => a.category === 'secret');

  it('the catalogue has secrets to protect', () => {
    expect(secrets.length).toBeGreaterThan(0);
  });

  it('never reveals a locked secret', () => {
    for (const a of secrets) {
      const shown = achievementDisplay({ ...a, completed: false });
      if (a.secretName) expect(shown.name).not.toContain(a.secretName);
      if (a.secretDescription) expect(shown.description).not.toContain(a.secretDescription);
    }
  });

  it('reveals the real name and condition once earned', () => {
    for (const a of secrets) {
      const shown = achievementDisplay({ ...a, completed: true });
      expect(shown.name).toBe(a.secretName || a.name);
      expect(shown.description).toBe(a.secretDescription || a.description);
    }
  });

  it('leaves ordinary achievements alone', () => {
    const plain = createTestGameState().achievements.find((a) => a.category !== 'secret')!;
    expect(achievementDisplay(plain)).toEqual({ name: plain.name, description: plain.description });
  });
});
