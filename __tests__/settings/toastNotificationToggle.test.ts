/**
 * The Pop-up Notifications setting (2026-08-24, owner request).
 *
 * `settings.notificationsEnabled` had a default, a repair mirror and a save
 * slot but ZERO consumers, so it was pulled from the Settings screen as a
 * misleading toggle. These tests pin the three things that make it real:
 * the policy itself, the exemption for warnings/errors, and the fact that
 * ToastContext and SettingsModal are actually wired to it (a source check,
 * because a toggle that stops being read is exactly how this field died the
 * first time).
 */
import fs from 'fs';
import path from 'path';
import { shouldShowToast, ALWAYS_SHOWN_TIERS, type ToastTier } from '@/utils/toastPolicy';
import { initialGameState } from '@/contexts/game/initialState';

const ROOT = path.resolve(__dirname, '..', '..');
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf-8');

const ALL_TIERS: ToastTier[] = ['success', 'error', 'warning', 'info'];

describe('shouldShowToast', () => {
  it('shows every tier while notifications are on', () => {
    for (const tier of ALL_TIERS) {
      expect({ tier, shown: shouldShowToast(tier, true) }).toEqual({ tier, shown: true });
    }
  });

  it('mutes only the congratulatory tiers when off', () => {
    expect(shouldShowToast('success', false)).toBe(false);
    expect(shouldShowToast('info', false)).toBe(false);
  });

  it('NEVER mutes warnings or errors', () => {
    // Warnings are the rejection channel (a refused application, a blocked
    // retirement); errors carry the Report action. Muting either behind a
    // toggle would re-ship the bug ToastContext documents.
    for (const tier of ALWAYS_SHOWN_TIERS) {
      expect({ tier, shown: shouldShowToast(tier, false) }).toEqual({ tier, shown: true });
    }
  });

  it('fails OPEN on an absent or malformed preference', () => {
    // Partial save, or no game state at all (onboarding): show everything.
    for (const tier of ALL_TIERS) {
      expect(shouldShowToast(tier, undefined)).toBe(true);
      expect(shouldShowToast(tier, null)).toBe(true);
    }
  });
});

describe('the setting is real, not decorative', () => {
  it('defaults to ON, so nobody loses feedback by upgrading', () => {
    expect(initialGameState.settings.notificationsEnabled).toBe(true);
  });

  it('ToastContext consults the policy before queueing a toast', () => {
    const src = read('contexts/ToastContext.tsx');
    expect(src).toMatch(/shouldShowToast\(/);
    expect(src).toMatch(/notificationsEnabled/);
  });

  it('SettingsModal exposes the toggle bound to that same field', () => {
    const src = read('components/SettingsModal.tsx');
    expect(src).toMatch(/id: 'notificationsEnabled'/);
    expect(src).toMatch(/value: settings\.notificationsEnabled/);
  });

  it('the toggle copy warns that warnings and errors stay', () => {
    // The exemption has to be stated, or a player who turns it off and still
    // sees a refusal toast reads it as broken.
    const src = read('components/SettingsModal.tsx');
    const block = src.slice(src.indexOf("id: 'notificationsEnabled'"));
    expect(block.slice(0, 500)).toMatch(/Warnings and errors always show/i);
  });
});
